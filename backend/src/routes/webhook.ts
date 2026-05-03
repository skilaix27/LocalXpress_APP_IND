import { Router } from "express";
import {
  getDraftOrderById,
  getPaidOrderBySessionId,
  savePaidOrder,
  markCentralOrderCreated,
} from "../services/orders";
import { sendAdminOrderEmail, sendCustomerConfirmationEmail } from "../services/email";
import { verifyWebhookSignature, StripeNotConfiguredError } from "../services/stripe";
import { generatePublicOrderCode } from "../services/orderCode";
import { createOrderInCentralApi } from "../services/centralApi";

export const webhookRouter = Router();

// POST /api/stripe/webhook
// Mounted via: app.use("/api/stripe/webhook", express.raw(...), webhookRouter)
// Express strips the mount prefix, so the handler path here is "/"
webhookRouter.post("/", async (req, res) => {
  // 1. Guard: webhook secret must be configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    res.status(400).json({ ok: false, error: "Webhook secret not configured." });
    return;
  }

  // 2. Guard: signature header must be present
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    console.warn("[webhook] Missing or invalid stripe-signature header.");
    res.status(400).json({ ok: false, error: "Missing signature." });
    return;
  }

  // 3. Verify signature — req.body is a Buffer thanks to express.raw()
  let event: ReturnType<typeof verifyWebhookSignature>;
  try {
    event = verifyWebhookSignature(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    if (err instanceof StripeNotConfiguredError) {
      console.error("[webhook] STRIPE_SECRET_KEY is not configured.");
      res.status(503).json({ ok: false, error: "Stripe not configured." });
    } else {
      console.error("[webhook] Signature verification failed:", (err as Error).message);
      res.status(400).json({ ok: false, error: "Invalid webhook signature." });
    }
    return;
  }

  // 4. Only process checkout.session.completed
  if (event.type !== "checkout.session.completed") {
    console.log(`[webhook] Ignoring event type: ${event.type}`);
    res.json({ ok: true, received: true });
    return;
  }

  const session       = event.data.object;
  const sessionId     = session.id;
  const draftId       = session.metadata?.draft_id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  console.log(
    `[webhook] checkout.session.completed — session: ${sessionId}, draft: ${draftId ?? "none"}`
  );

  // 5. Require draft_id in metadata
  if (!draftId) {
    console.warn("[webhook] No draft_id in session metadata — skipping.");
    res.json({ ok: true, received: true });
    return;
  }

  if (!paymentIntentId) {
    console.warn(`[webhook] No payment_intent string in session ${sessionId} — skipping.`);
    res.json({ ok: true, received: true });
    return;
  }

  // 6. Full idempotency guard:
  //    If the order was already fully processed (central_order_created === true),
  //    there is nothing left to do — respond 200 so Stripe stops retrying.
  const existingOrder = await getPaidOrderBySessionId(sessionId);
  if (existingOrder?.central_order_created) {
    console.log(
      `[webhook] Order ${existingOrder.order_code} already fully processed — skipping duplicate.`
    );
    res.json({ ok: true, received: true, order_id: existingOrder.id, order_code: existingOrder.order_code });
    return;
  }

  // 7. Recover draft
  const draft = await getDraftOrderById(draftId);
  if (!draft) {
    console.warn(`[webhook] Draft ${draftId} not found — skipping order creation.`);
    res.json({ ok: true, received: true });
    return;
  }

  // 8. Create or recover the paid order
  let paidOrder: Awaited<ReturnType<typeof savePaidOrder>>;

  if (existingOrder) {
    // Order exists but central sync hasn't completed yet — resume from here
    console.log(`[webhook] Resuming processing for existing order ${existingOrder.order_code}.`);
    paidOrder = existingOrder;
  } else {
    // New payment: generate code and persist
    const orderCode = await generatePublicOrderCode();
    console.log(`[webhook] Generated order code: ${orderCode}`);

    try {
      paidOrder = await savePaidOrder({
        ...draft,
        order_code:                 orderCode,
        stripe_checkout_session_id: sessionId,
        stripe_payment_intent_id:   paymentIntentId,
      });
    } catch (err: unknown) {
      console.error("[webhook] Failed to save paid order:", (err as Error).message);
      res.status(500).json({ ok: false, error: "Failed to save order." });
      return;
    }
  }

  // 9. Send order to the central LocalXpress backend
  //    Failures here are non-fatal — the paid order is already persisted locally.
  const centralResult = await createOrderInCentralApi(paidOrder);

  if (centralResult.ok) {
    // Persist central IDs and mark as synced so retries skip this step
    await markCentralOrderCreated(paidOrder.id, {
      central_order_id:   centralResult.central_order_id,
      central_order_code: centralResult.central_order_code,
    });

    if (centralResult.duplicate) {
      // Central backend already had this session — emails were sent on the first run.
      // Do not re-send to avoid duplicates.
      console.log(`[webhook] Duplicate in central API — skipping emails for ${paidOrder.order_code}`);
      res.json({ ok: true, received: true, order_id: paidOrder.id, order_code: paidOrder.order_code });
      return;
    }

    console.log(
      `[webhook] Central order synced — id: ${centralResult.central_order_id}, ` +
      `code: ${centralResult.central_order_code}`
    );
  } else {
    console.warn(`[webhook] Central API call failed: ${centralResult.error}`);
    // Do NOT return 500 — the local order is saved and the customer paid.
    // Stripe will retry the webhook, which will reach the existingOrder branch
    // and attempt the central API call again, then check for duplicate.
  }

  // 10. Send emails — controlled by SEND_LOCAL_EMAILS env var.
  //     Default: false — the central LocalXpress app handles all notifications.
  //     Set to "true" only for testing or as backup when the central app is unavailable.
  if (process.env.SEND_LOCAL_EMAILS === "true") {
    const [adminResult, customerResult] = await Promise.allSettled([
      sendAdminOrderEmail(paidOrder),
      sendCustomerConfirmationEmail(paidOrder),
    ]);

    for (const [name, result] of [
      ["admin",    adminResult   ],
      ["customer", customerResult],
    ] as const) {
      if (result.status === "rejected") {
        console.warn(`[webhook] ${name} email threw:`, result.reason);
      } else if (!result.value.ok) {
        console.warn(`[webhook] ${name} email failed:`, result.value.error);
      }
    }
  } else {
    console.log(`[email] Local emails disabled — central app handles notifications.`);
  }

  console.log(`[webhook] ✓ Order ${paidOrder.id} (${paidOrder.order_code}) processed.`);
  res.json({ ok: true, received: true, order_id: paidOrder.id, order_code: paidOrder.order_code });
});

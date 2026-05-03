import Stripe from "stripe";

// ─── Error ────────────────────────────────────────────────────────────────────

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

// ─── Singleton client ─────────────────────────────────────────────────────────

type StripeInstance = InstanceType<typeof Stripe>;
let _stripe: StripeInstance | null = null;

function getStripe(): StripeInstance {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCheckoutSessionParams {
  price_eur:      number;
  customer_email: string;
  draft_id:       string;
}

export interface CheckoutSessionResult {
  checkout_url: string;
  session_id:   string;
}

// ─── Webhook verification ─────────────────────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: Buffer,
  sig: string,
  webhookSecret: string
) {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
}

// ─── Checkout session ─────────────────────────────────────────────────────────

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const stripe = getStripe(); // throws StripeNotConfiguredError if key missing

  const successUrl = process.env.PUBLIC_APP_SUCCESS_URL;
  const cancelUrl  = process.env.PUBLIC_APP_CANCEL_URL;

  if (!successUrl || !cancelUrl) {
    throw new Error(
      "PUBLIC_APP_SUCCESS_URL and PUBLIC_APP_CANCEL_URL must be configured."
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode:           "payment",
    customer_email: params.customer_email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency:    "eur",
          unit_amount: Math.round(params.price_eur * 100), // EUR → cents
          product_data: {
            name:        "Servicio de envío LocalXpress",
            description: "Recogida y entrega programada",
          },
        },
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  cancelUrl,
    metadata: {
      draft_id:   params.draft_id,
      source:     "individual_web",
      order_type: "individual",
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    checkout_url: session.url,
    session_id:   session.id,
  };
}

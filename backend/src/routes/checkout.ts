import { Router } from "express";
import { QuoteRequestSchema } from "../schemas/quote";
import { calculateRouteDistance } from "../services/googleMaps";
import { calculatePriceByDistance } from "../services/pricing";
import { createDraftOrder } from "../services/orders";
import { createCheckoutSession, StripeNotConfiguredError } from "../services/stripe";
import { checkoutLimiter } from "../middleware/rateLimiter";

export const checkoutRouter = Router();

checkoutRouter.post("/checkout", checkoutLimiter, async (req, res) => {
  // 1. Validate input — same schema as quote
  const parsed = QuoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Datos inválidos",
      details: parsed.error.errors.map((e) => ({
        field:   e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const data = parsed.data;

  // 2. Recalculate route — never trust frontend price
  let routeResult: Awaited<ReturnType<typeof calculateRouteDistance>>;
  try {
    routeResult = await calculateRouteDistance({
      pickup_address:   data.pickup_address,
      delivery_address: data.delivery_address,
    });
  } catch (err: unknown) {
    console.error("[checkout] Route calculation failed:", (err as Error).message);
    res.status(502).json({
      ok: false,
      error: "No se ha podido calcular la ruta. Revisa las direcciones e inténtalo de nuevo.",
    });
    return;
  }

  // 3. Recalculate price — backend is the only source of truth
  let priceResult: ReturnType<typeof calculatePriceByDistance>;
  try {
    priceResult = calculatePriceByDistance(routeResult.distance_km);
  } catch (err: unknown) {
    console.error("[checkout] Pricing error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Error interno al calcular el precio." });
    return;
  }

  // 4. Block manual quotes — Stripe checkout not available for them
  if (priceResult.manual_quote_required) {
    res.status(400).json({
      ok: false,
      error:
        "Este servicio requiere presupuesto personalizado. Contacta con LocalXpress a través de nuestro canal de atención al cliente o info@localxpress.es.",
    });
    return;
  }

  // 5. Save draft — links form data to the Stripe session via metadata.draft_id
  let draft: Awaited<ReturnType<typeof createDraftOrder>>;
  try {
    draft = await createDraftOrder({
      // Recipient of the package
      client_name:           data.client_name,
      client_phone:          data.client_phone,
      // Person placing / paying the order
      customer_full_name:    data.customer_full_name,
      customer_phone:        data.customer_phone,
      customer_email:        data.customer_email,
      // Service
      pickup_address:        data.pickup_address,
      delivery_address:      data.delivery_address,
      scheduled_date:        data.scheduled_date,
      scheduled_time:        data.scheduled_time,
      scheduled_time_type:   data.scheduled_time_type,
      package_size:          data.package_size,
      client_notes:          data.client_notes,
      pickup_lat:            data.pickup_lat   ?? null,
      pickup_lng:            data.pickup_lng   ?? null,
      delivery_lat:          data.delivery_lat ?? null,
      delivery_lng:          data.delivery_lng ?? null,
      distance_km:           routeResult.distance_km,
      duration_minutes:      routeResult.duration_minutes,
      zone_name:             priceResult.zone_name,
      price:                 priceResult.price,
      manual_quote_required: priceResult.manual_quote_required,
      distance_source:       routeResult.distance_source,
    });
  } catch (err: unknown) {
    console.error("[checkout] Failed to save draft:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Error interno al procesar el pedido." });
    return;
  }

  // 6. Create Stripe Checkout session
  try {
    const session = await createCheckoutSession({
      price_eur:      priceResult.price!,
      customer_email: data.customer_email,
      draft_id:       draft.id,
    });

    res.json({ ok: true, checkout_url: session.checkout_url });
  } catch (err: unknown) {
    if (err instanceof StripeNotConfiguredError) {
      console.warn("[checkout] Stripe not configured");
      res.status(503).json({ ok: false, error: "Stripe is not configured." });
    } else {
      // Never expose internal Stripe errors to the client
      console.error("[checkout] Stripe session creation failed:", (err as Error).message);
      res.status(502).json({
        ok: false,
        error: "No se ha podido iniciar el pago. Inténtalo de nuevo.",
      });
    }
  }
});

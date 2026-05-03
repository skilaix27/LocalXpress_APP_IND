import { Router } from "express";
import { QuoteRequestSchema } from "../schemas/quote";
import { calculateRouteDistance, ROUTE_DISTANCE_BUFFER_KM } from "../services/googleMaps";
import { calculatePriceByDistance, MARGIN_KM } from "../services/pricing";
import { quoteLimiter } from "../middleware/rateLimiter";

export const quoteRouter = Router();

quoteRouter.post("/quote", quoteLimiter, async (req, res) => {
  // 1. Validate input
  const parsed = QuoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Datos inválidos",
      details: parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const { pickup_address, delivery_address } = parsed.data;

  // 2. Calculate route distance via Google Maps (or mock in dev)
  let routeResult: Awaited<ReturnType<typeof calculateRouteDistance>>;
  try {
    routeResult = await calculateRouteDistance({ pickup_address, delivery_address });
  } catch (err: unknown) {
    console.error("[quote] Route calculation failed:", (err as Error).message);
    res.status(502).json({
      ok: false,
      error:
        "No se ha podido calcular la ruta. Revisa las direcciones e inténtalo de nuevo.",
    });
    return;
  }

  // 3. Calculate zone and price
  let priceResult: ReturnType<typeof calculatePriceByDistance>;
  try {
    priceResult = calculatePriceByDistance(routeResult.distance_km);
  } catch (err: unknown) {
    console.error("[quote] Pricing error:", (err as Error).message);
    res.status(500).json({
      ok: false,
      error: "Error interno al calcular el precio.",
    });
    return;
  }

  // routeDistance = Google raw + ROUTE_DISTANCE_BUFFER_KM (0.3) — matches central app storage
  // distanceForPricingKm = routeDistance + MARGIN_KM (0.15) — matches central app zone lookup and UI display
  const routeDistance         = routeResult.distance_km;
  const googleDistanceKmRaw   = Number((routeDistance - ROUTE_DISTANCE_BUFFER_KM).toFixed(2));
  const distanceForPricingKm  = Number((routeDistance + MARGIN_KM).toFixed(2));

  console.log(
    `[quote] google_distance_km_raw=${googleDistanceKmRaw} | ` +
    `route_distance_km_with_buffer=${routeDistance} | ` +
    `distance_for_pricing_km=${distanceForPricingKm} | ` +
    `selected_zone=${priceResult.zone_name} | ` +
    `price=${priceResult.price ?? "manual"} EUR`
  );

  // 4. Build response
  // distance_km here is distanceForPricingKm — the value shown to the user and used for zone selection,
  // matching what the central app displays via adjustDistance(routeDistance).
  const response: Record<string, unknown> = {
    ok:                     true,
    distance_km:            distanceForPricingKm,
    duration_minutes:       routeResult.duration_minutes,
    zone_name:              priceResult.zone_name,
    price:                  priceResult.price,
    manual_quote_required:  priceResult.manual_quote_required,
    distance_source:        routeResult.distance_source,
  };

  if (priceResult.manual_quote_required) {
    response.message =
      "Este servicio requiere presupuesto personalizado. Contacta con LocalXpress a través de nuestro canal de atención al cliente o info@localxpress.es.";
  }

  res.json(response);
});

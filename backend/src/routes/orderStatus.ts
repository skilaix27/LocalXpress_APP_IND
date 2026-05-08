import { Router } from "express";
import { getPaidOrderBySessionId } from "../services/orders";
import { orderStatusLimiter } from "../middleware/rateLimiter";

export const orderStatusRouter = Router();

// GET /api/public/order-status?session_id=cs_test_...
orderStatusRouter.get("/order-status", orderStatusLimiter, async (req, res) => {
  const sessionId = (req.query.session_id as string | undefined)?.trim();

  if (!sessionId) {
    res.status(400).json({ ok: false, error: "session_id is required." });
    return;
  }

  try {
    const order = await getPaidOrderBySessionId(sessionId);

    if (!order) {
      // Webhook may not have fired yet — client should poll
      res.json({ ok: true, payment_status: "pending" });
      return;
    }

    res.json({
      ok:                  true,
      payment_status:      "paid",
      order_code:          order.order_code,
      customer_full_name:  order.customer_full_name ?? null,
      client_name:         order.client_name,
      pickup_address:      order.pickup_address,
      delivery_address:    order.delivery_address,
      scheduled_date:      order.scheduled_date,
      scheduled_time:      order.scheduled_time,
      zone_name:           order.zone_name,
      price:               order.price,
    });
  } catch (err: unknown) {
    console.error("[order-status] Error:", (err as Error).message);
    res.status(500).json({ ok: false, error: "Error al consultar el estado del pedido." });
  }
});

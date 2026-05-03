import {
  createDraftOrder,
  getDraftOrderById,
  savePaidOrder,
  getPaidOrderBySessionId,
  listPaidOrders,
} from "../src/services/orders";

async function main() {
  console.log("=== 1. createDraftOrder ===");
  const draft = await createDraftOrder({
    pickup_address:        "Carrer Mallorca 120, Barcelona",
    delivery_address:      "Carrer Balmes 55, Barcelona",
    client_name:           "Ana García",
    client_phone:          "612345678",
    customer_email:        "ana@ejemplo.com",
    scheduled_date:        "2026-05-10",
    scheduled_time:        "10:00",
    package_size:          "small",
    client_notes:          "Llamar antes de llegar",
    distance_km:           1.68,
    duration_minutes:      6,
    zone_name:             "Zona 1",
    price:                 8,
    manual_quote_required: false,
    distance_source:       "google_maps",
  });
  console.log("Draft created:", JSON.stringify(draft, null, 2));

  console.log("\n=== 2. getDraftOrderById ===");
  const found = await getDraftOrderById(draft.id);
  console.log("Found:", found ? `id=${found.id}` : "null");

  const notFound = await getDraftOrderById("non-existent-id");
  console.log("Not found:", notFound);

  console.log("\n=== 3. savePaidOrder ===");
  const paid = await savePaidOrder({
    ...draft,
    stripe_checkout_session_id: "cs_test_ABC123",
    stripe_payment_intent_id:   "pi_test_XYZ789",
  });
  console.log("Paid order:", JSON.stringify(paid, null, 2));

  console.log("\n=== 4. savePaidOrder idempotency (same session) ===");
  const duplicate = await savePaidOrder({
    ...draft,
    stripe_checkout_session_id: "cs_test_ABC123",
    stripe_payment_intent_id:   "pi_test_XYZ789",
  });
  console.log("Idempotent? Same id:", duplicate.id === paid.id);

  console.log("\n=== 5. getPaidOrderBySessionId ===");
  const bySession = await getPaidOrderBySessionId("cs_test_ABC123");
  console.log("By session:", bySession ? `id=${bySession.id}` : "null");

  console.log("\n=== 6. listPaidOrders ===");
  const all = await listPaidOrders();
  console.log(`Total paid orders: ${all.length}`);
}

main().catch(console.error);

import dotenv from "dotenv";
import { sendAdminOrderEmail, sendCustomerConfirmationEmail } from "../src/services/email";

dotenv.config({ quiet: true });

const fakeOrder = {
  id:                         "test-order-001",
  created_at:                 "2026-05-01T10:00:00Z",
  pickup_address:             "Carrer Mallorca 120, Barcelona",
  delivery_address:           "Carrer Balmes 55, Barcelona",
  client_name:                "Ana García",
  client_phone:               "612345678",
  customer_email:             "ana@ejemplo.com",
  scheduled_date:             "2026-05-10",
  scheduled_time:             "10:00",
  package_size:               "small" as const,
  client_notes:               "Llamar antes de llegar",
  distance_km:                1.68,
  duration_minutes:           6,
  zone_name:                  "Zona 1",
  price:                      8,
  manual_quote_required:      false,
  distance_source:            "google_maps" as const,
  stripe_checkout_session_id: "cs_test_ABC123",
  stripe_payment_intent_id:   "pi_test_XYZ789",
  payment_status:             "paid" as const,
  paid_by_client:             true as const,
  paid_by_client_at:          "2026-05-01T10:05:00Z",
  order_type:                 "individual" as const,
  source:                     "individual_web" as const,
};

async function main() {
  console.log("SMTP_HOST present:", !!process.env.SMTP_HOST);
  console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL ?? "(not set)");
  console.log();

  console.log("=== sendAdminOrderEmail ===");
  const r1 = await sendAdminOrderEmail(fakeOrder);
  console.log("Result:", JSON.stringify(r1));

  console.log("\n=== sendCustomerConfirmationEmail ===");
  const r2 = await sendCustomerConfirmationEmail(fakeOrder);
  console.log("Result:", JSON.stringify(r2));
}

main().catch(console.error);

import type { PaidOrder } from "./orders";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CentralApiResult {
  ok:                  boolean;
  duplicate?:          boolean;   // central API already had this session
  central_order_id?:   string;
  central_order_code?: string;    // code assigned by the central backend (may differ from LXP local)
  error?:              string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIME_REGEX     = /^\d{2}:\d{2}$/;
const HAS_TZ_REGEX   = /(?:[Zz]$|[+-]\d{2}:\d{2}$)/;
const NAIVE_DT_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function getMadridOffsetString(date: Date): string {
  // Uses Intl to get the current UTC offset for Europe/Madrid (handles DST automatically).
  // Returns "+02:00" in summer (CEST) and "+01:00" in winter (CET).
  const parts = new Intl.DateTimeFormat("en", {
    timeZone:     "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(date);

  const tzValue = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match   = tzValue.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return "+01:00";

  const sign    = match[1];
  const hours   = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function normalizeScheduledPickupAtForCentralApi(date: string, time: string): string {
  // Build naive datetime from date ("YYYY-MM-DD") + time ("HH:MM" or human label).
  const safeTime = TIME_REGEX.test(time) ? time : "10:00";
  const naive    = `${date}T${safeTime}:00`;

  // If it already carries timezone info, return it unchanged.
  if (HAS_TZ_REGEX.test(naive)) return naive;

  // Parse the naive datetime to determine the correct DST offset for that specific day.
  const m = naive.match(NAIVE_DT_REGEX);
  if (!m) return `${naive}+01:00`; // fallback

  const [, y, mo, d] = m;
  // Use noon on that day as the reference point to avoid DST boundary edge cases.
  const reference = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
  const offset    = getMadridOffsetString(reference);

  return `${naive}${offset}`;
}

const isDebug = () => process.env.LOG_LEVEL === "debug";

// ─── Central API call ─────────────────────────────────────────────────────────

export async function createOrderInCentralApi(
  order: PaidOrder
): Promise<CentralApiResult> {
  const apiKey = process.env.LOCALXPRESS_CENTRAL_API_KEY;
  if (!apiKey) {
    console.warn("[centralApi] LOCALXPRESS_CENTRAL_API_KEY not configured — skipping.");
    return { ok: false, error: "LOCALXPRESS_CENTRAL_API_KEY is not configured" };
  }

  const apiUrl =
    (process.env.LOCALXPRESS_CENTRAL_API_URL || "https://api.localxpress.app").replace(/\/$/, "");

  const price         = order.price ?? null;
  const price_driver  = price !== null ? Math.round(price * 0.70 * 100) / 100 : null;
  const price_company = price !== null && price_driver !== null
    ? Math.round((price - price_driver) * 100) / 100
    : null;

  const payload = {
    order_code:                 order.order_code,
    source:                     "individual_web",
    order_type:                 "individual",
    payment_status:             "paid",
    pickup_address:             order.pickup_address,
    pickup_lat:                 order.pickup_lat   ?? null,
    pickup_lng:                 order.pickup_lng   ?? null,
    delivery_address:           order.delivery_address,
    delivery_lat:               order.delivery_lat ?? null,
    delivery_lng:               order.delivery_lng ?? null,
    client_name:                order.client_name,
    client_phone:               order.client_phone,
    customer_email:             order.customer_email,
    customer_full_name:         order.client_name,
    customer_phone:             order.client_phone,
    client_notes:               order.client_notes || null,
    scheduled_pickup_at:        normalizeScheduledPickupAtForCentralApi(order.scheduled_date, order.scheduled_time),
    distance_km:                order.distance_km,
    package_size:               order.package_size,
    price,
    price_driver,
    price_company,
    stripe_checkout_session_id: order.stripe_checkout_session_id,
    stripe_payment_intent_id:   order.stripe_payment_intent_id,
  };

  // Safe log: order_code and non-PII fields only
  console.log(`[centralApi] Central sync started — order: ${order.order_code}`);

  // Debug-only log: full payload including PII — never enabled in production
  if (isDebug()) {
    console.log("[centralApi] debug payload:", {
      order_code:                 payload.order_code,
      source:                     payload.source,
      order_type:                 payload.order_type,
      payment_status:             payload.payment_status,
      stripe_checkout_session_id: payload.stripe_checkout_session_id,
      stripe_payment_intent_id:   payload.stripe_payment_intent_id,
      customer_email:             payload.customer_email,
      pickup_address:             payload.pickup_address,
      delivery_address:           payload.delivery_address,
      client_name:                payload.client_name,
      scheduled_pickup_at:        payload.scheduled_pickup_at,
      distance_km:                payload.distance_km,
      package_size:               payload.package_size,
      price:                      payload.price,
      price_driver:               payload.price_driver,
      price_company:              payload.price_company,
      pickup_lat:                 payload.pickup_lat,
      pickup_lng:                 payload.pickup_lng,
      delivery_lat:               payload.delivery_lat,
      delivery_lng:               payload.delivery_lng,
    });
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/stops/order`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":    apiKey,  // key only in backend — never reaches frontend
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    // Never log apiKey
    console.error("[centralApi] Network error:", (err as Error).message);
    return { ok: false, error: "Network error reaching central API." };
  }

  let data: {
    ok?: boolean;
    id?: string;
    order_code?: string;
    duplicate?: boolean;
    error?: string;
  } = {};

  try {
    data = await response.json();
  } catch {
    console.error("[centralApi] Non-JSON response, status:", response.status);
    return { ok: false, error: `Unexpected response from central API (${response.status}).` };
  }

  // duplicate = true means the central backend already has this session — not an error
  if (data.duplicate) {
    console.log(
      `[centralApi] Duplicate detected — session already exists in central backend. order: ${order.order_code}`
    );
    return {
      ok:                  true,
      duplicate:           true,
      central_order_id:    data.id,
      central_order_code:  data.order_code,
    };
  }

  if (!response.ok) {
    // Log status and error message; guard response body behind debug to avoid echoed PII
    console.error(`[centralApi] Error response: status=${response.status} error=${data.error ?? "(no message)"}`);
    if (isDebug()) {
      console.error("[centralApi] Error details:", JSON.stringify(data, null, 2));
    }
    return { ok: false, error: data.error ?? `Central API error (${response.status}).` };
  }

  const centralCode = data.order_code ?? order.order_code;
  console.log(
    `[centralApi] Central sync success — central_id: ${data.id ?? "unknown"}, central_code: ${centralCode}, local: ${order.order_code}`
  );
  return {
    ok:                  true,
    duplicate:           false,
    central_order_id:    data.id,
    central_order_code:  centralCode,
  };
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotePayload {
  pickup_address:   string;
  delivery_address: string;
  client_name:      string;
  client_phone:     string;
  customer_email:   string;
  scheduled_date:   string;
  scheduled_time:   string;
  package_size:     "small" | "medium" | "large";
  client_notes?:    string;
  pickup_lat?:      number | null;
  pickup_lng?:      number | null;
  delivery_lat?:    number | null;
  delivery_lng?:    number | null;
}

export interface QuoteResult {
  ok:                    boolean;
  distance_km?:          number;
  duration_minutes?:     number | null;
  zone_name?:            string;
  price?:                number | null;
  manual_quote_required?: boolean;
  distance_source?:      "google_maps" | "mock";
  message?:              string;
  error?:                string;
  details?:              Array<{ field: string; message: string }>;
}

export interface CheckoutResult {
  ok:            boolean;
  checkout_url?: string;
  error?:        string;
}

export interface OrderStatusResult {
  ok:               boolean;
  payment_status?:  "paid" | "pending";
  order_code?:      string;
  client_name?:     string;
  pickup_address?:  string;
  delivery_address?: string;
  scheduled_date?:  string;
  scheduled_time?:  string;
  zone_name?:       string;
  price?:           number | null;
  error?:           string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return res.json() as Promise<T>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export function getQuote(payload: QuotePayload): Promise<QuoteResult> {
  return postJson<QuoteResult>("/api/public/quote", payload);
}

export function createCheckout(payload: QuotePayload): Promise<CheckoutResult> {
  return postJson<CheckoutResult>("/api/public/checkout", payload);
}

export async function getOrderStatus(sessionId: string): Promise<OrderStatusResult> {
  const res = await fetch(
    `${API_URL}/api/public/order-status?session_id=${encodeURIComponent(sessionId)}`
  );
  return res.json() as Promise<OrderStatusResult>;
}

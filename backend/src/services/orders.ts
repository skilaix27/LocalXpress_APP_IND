import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// ─── Paths ───────────────────────────────────────────────────────────────────

const DATA_DIR    = path.resolve(__dirname, "../../data");
const DRAFTS_FILE = path.join(DATA_DIR, "drafts.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderDraft {
  id:                    string;
  created_at:            string;
  // Recipient of the package
  client_name:           string;
  client_phone:          string;
  // Person placing / paying the order (optional for backward-compat with old orders)
  customer_full_name?:   string;
  customer_phone?:       string;
  customer_email:        string;
  // Service
  pickup_address:        string;
  delivery_address:      string;
  scheduled_date:        string;
  scheduled_time:        string;
  scheduled_time_type?:  "asap" | "morning" | "afternoon" | "specific";
  package_size:          "small" | "medium" | "large";
  client_notes?:         string;
  pickup_lat?:           number | null;
  pickup_lng?:           number | null;
  delivery_lat?:         number | null;
  delivery_lng?:         number | null;
  distance_km:           number;
  duration_minutes:      number | null;
  zone_name:             string;
  price:                 number | null;
  manual_quote_required: boolean;
  distance_source:       "google_maps" | "mock";
}

export interface PaidOrder extends OrderDraft {
  order_code:                 string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id:   string;
  payment_status:             "paid";
  paid_by_client:             true;
  paid_by_client_at:          string;
  order_type:                 "individual";
  source:                     "individual_web";
  // Tracks whether the order was successfully sent to the central LocalXpress backend.
  // Optional for backward-compatibility with orders saved before this field was added.
  central_order_created?:     boolean;
  central_order_id?:          string;   // ID assigned by the central backend
  central_order_code?:        string;   // Code from central backend (may differ from order_code)
}

export type CreateDraftOrderInput = Omit<OrderDraft, "id" | "created_at">;

export type SavePaidOrderInput = OrderDraft & {
  order_code:                 string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id:   string;
};

// ─── File I/O ────────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T[] {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (raw === "" || raw === "null") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array in ${path.basename(filePath)}`);
    }
    return parsed as T[];
  } catch (err: unknown) {
    throw new Error(
      `Corrupted data file (${path.basename(filePath)}): ${(err as Error).message}`
    );
  }
}

function writeJsonFile<T>(filePath: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ─── Draft cleanup ────────────────────────────────────────────────────────────

// Removes drafts older than maxAgeHours from drafts.json.
// Never touches orders.json. Safe to call before creating a new draft.
export async function cleanupOldDrafts(maxAgeHours = 24): Promise<{ removed: number }> {
  try {
    const drafts = readJsonFile<OrderDraft>(DRAFTS_FILE);
    const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const fresh = drafts.filter((d) => {
      const ts = new Date(d.created_at).getTime();
      return Number.isNaN(ts) || ts >= cutoffMs; // keep if unreadable (safe default)
    });
    const removed = drafts.length - fresh.length;
    if (removed > 0) {
      writeJsonFile(DRAFTS_FILE, fresh);
    }
    if (process.env.LOG_LEVEL === "debug") {
      console.log(`[orders] cleanupOldDrafts: removed=${removed}, kept=${fresh.length}`);
    }
    return { removed };
  } catch (err: unknown) {
    console.warn("[orders] cleanupOldDrafts failed (non-fatal):", (err as Error).message);
    return { removed: 0 };
  }
}

// ─── Draft orders ─────────────────────────────────────────────────────────────

export async function createDraftOrder(
  input: CreateDraftOrderInput
): Promise<OrderDraft> {
  // Best-effort cleanup of stale drafts — failure must never block order creation.
  void cleanupOldDrafts();

  const draft: OrderDraft = {
    id:         randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const drafts = readJsonFile<OrderDraft>(DRAFTS_FILE);
  drafts.push(draft);
  writeJsonFile(DRAFTS_FILE, drafts);
  return draft;
}

export async function getDraftOrderById(id: string): Promise<OrderDraft | null> {
  const drafts = readJsonFile<OrderDraft>(DRAFTS_FILE);
  return drafts.find((d) => d.id === id) ?? null;
}

// ─── Paid orders ─────────────────────────────────────────────────────────────

export async function savePaidOrder(input: SavePaidOrderInput): Promise<PaidOrder> {
  const existing = await getPaidOrderBySessionId(input.stripe_checkout_session_id);
  if (existing) {
    console.log(
      `[orders] Session ${input.stripe_checkout_session_id} already paid — returning existing.`
    );
    return existing;
  }

  const order: PaidOrder = {
    ...input,
    payment_status:    "paid",
    paid_by_client:    true,
    paid_by_client_at: new Date().toISOString(),
    order_type:        "individual",
    source:            "individual_web",
  };

  const orders = readJsonFile<PaidOrder>(ORDERS_FILE);
  orders.push(order);
  writeJsonFile(ORDERS_FILE, orders);
  console.log(
    `[orders] Paid order saved: ${order.id} (session: ${input.stripe_checkout_session_id})`
  );
  return order;
}

export async function getPaidOrderBySessionId(
  sessionId: string
): Promise<PaidOrder | null> {
  const orders = readJsonFile<PaidOrder>(ORDERS_FILE);
  return orders.find((o) => o.stripe_checkout_session_id === sessionId) ?? null;
}

export async function listPaidOrders(): Promise<PaidOrder[]> {
  return readJsonFile<PaidOrder>(ORDERS_FILE);
}

export async function markCentralOrderCreated(
  orderId: string,
  centralData?: { central_order_id?: string; central_order_code?: string }
): Promise<void> {
  const orders = readJsonFile<PaidOrder>(ORDERS_FILE);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return;
  orders[idx] = {
    ...orders[idx],
    central_order_created: true,
    ...(centralData?.central_order_id   && { central_order_id:   centralData.central_order_id }),
    ...(centralData?.central_order_code && { central_order_code: centralData.central_order_code }),
  };
  writeJsonFile(ORDERS_FILE, orders);
}

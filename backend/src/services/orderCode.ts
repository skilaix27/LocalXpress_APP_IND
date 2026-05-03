import * as fs from "fs";
import * as path from "path";

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR   = path.resolve(__dirname, "../../data");
const STATE_FILE = path.join(DATA_DIR, "order-code-state.json");

// ─── Spanish month initials ───────────────────────────────────────────────────

const MONTH_INITIALS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayState {
  lastNumber: number;
  usedCodes:  string[];
}

type CodeState = Record<string, DayState>;

// ─── File I/O ─────────────────────────────────────────────────────────────────

function readState(): CodeState {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) return {};
  const raw = fs.readFileSync(STATE_FILE, "utf-8").trim();
  if (!raw || raw === "{}") return {};
  try {
    return JSON.parse(raw) as CodeState;
  } catch {
    console.warn("[orderCode] Corrupted state file — resetting.");
    return {};
  }
}

function writeState(state: CodeState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayKey(date: Date): string {
  return date.toISOString().split("T")[0]; // "2026-05-01"
}

function getDayPrefix(date: Date): string {
  const dd            = String(date.getDate()).padStart(2, "0");
  const monthInitial  = MONTH_INITIALS[date.getMonth()];
  return `LXP-D${dd}${monthInitial}`;
}

function randomIncrement(): number {
  return Math.floor(Math.random() * 5) + 1; // 1–5
}

// ─── Public function ──────────────────────────────────────────────────────────

export async function generatePublicOrderCode(): Promise<string> {
  const now      = new Date();
  const todayKey = getTodayKey(now);
  const prefix   = getDayPrefix(now);

  const state    = readState();
  const dayState = state[todayKey];

  // ── First order of the day ────────────────────────────────────────────────
  if (!dayState) {
    const code = `${prefix}-P65`;
    state[todayKey] = { lastNumber: 65, usedCodes: [code] };
    writeState(state);
    return code;
  }

  // ── Subsequent orders: random +1–5 with collision guard ───────────────────
  let candidate = dayState.lastNumber;
  for (let attempt = 0; attempt < 50; attempt++) {
    candidate += randomIncrement();
    const code = `${prefix}-P${candidate}`;
    if (!dayState.usedCodes.includes(code)) {
      dayState.lastNumber = candidate;
      dayState.usedCodes.push(code);
      state[todayKey] = dayState;
      writeState(state);
      return code;
    }
  }

  // ── Safety fallback: large jump to guarantee uniqueness ───────────────────
  candidate = dayState.lastNumber + 100;
  const fallback = `${prefix}-P${candidate}`;
  dayState.lastNumber = candidate;
  dayState.usedCodes.push(fallback);
  state[todayKey] = dayState;
  writeState(state);
  console.warn(`[orderCode] Fallback code used: ${fallback}`);
  return fallback;
}

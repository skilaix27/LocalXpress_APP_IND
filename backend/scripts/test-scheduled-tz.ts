import { buildScheduledPickupAt } from "../src/services/centralApi";

const cases: Array<[string, string, "asap" | "morning" | "afternoon" | "specific" | undefined, string | null, string]> = [
  ["2026-05-02",  "10:00",               "specific",  "2026-05-02T10:00:00+02:00", "specific verano → +02:00"],
  ["2026-01-15",  "09:30",               "specific",  "2026-01-15T09:30:00+01:00", "specific invierno → +01:00"],
  ["2026-03-29",  "10:00",               "specific",  "2026-03-29T10:00:00+02:00", "specific cambio hora (CEST) → +02:00"],
  ["2026-10-25",  "10:00",               "specific",  "2026-10-25T10:00:00+01:00", "specific cambio hora (CET)  → +01:00"],
  ["2026-05-02",  "Lo antes posible",    "asap",      null,                        "asap → null"],
  ["2026-05-02",  "Mañana (10:00-14:00)","morning",   null,                        "morning → null"],
  ["2026-12-25",  "Tarde (16:00-20:00)", "afternoon", null,                        "afternoon → null"],
  // Backward compat: no timeType, HH:MM detected automatically
  ["2026-05-02",  "18:30",               undefined,   "2026-05-02T18:30:00+02:00", "sin timeType, HH:MM → timestamp"],
  // Backward compat: no timeType, label detected automatically → null
  ["2026-05-02",  "Lo antes posible",    undefined,   null,                        "sin timeType, label → null"],
];

let allPass = true;

for (const [date, time, timeType, expected, label] of cases) {
  const result = buildScheduledPickupAt(date, time, timeType);
  const pass   = result === expected;
  if (!pass) allPass = false;
  const status = pass ? "✓" : "✗ FAIL";
  console.log(`${status}  ${label.padEnd(42)} → ${result ?? "null"}`);
  if (!pass) console.log(`       expected: ${expected ?? "null"}`);
}

if (allPass) {
  console.log("\nAll cases passed ✓");
} else {
  process.exit(1);
}

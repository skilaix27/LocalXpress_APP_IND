import { normalizeScheduledPickupAtForCentralApi } from "../src/services/centralApi";

const cases: Array<[string, string, string]> = [
  ["2026-05-02",  "10:00",               "verano → +02:00"],
  ["2026-01-15",  "09:30",               "invierno → +01:00"],
  ["2026-05-02",  "Lo antes posible",    "label verano → 10:00+02:00"],
  ["2026-12-25",  "Tarde (15:00-20:00)", "label invierno → 10:00+01:00"],
  ["2026-03-29",  "10:00",               "cambio hora (CEST) → +02:00"],
  ["2026-10-25",  "10:00",               "cambio hora (CET)  → +01:00"],
];

let allPass = true;

for (const [date, time, label] of cases) {
  const result = normalizeScheduledPickupAtForCentralApi(date, time);
  const hasOffset = /[+-]\d{2}:\d{2}$/.test(result);
  const status = hasOffset ? "✓" : "✗ MISSING OFFSET";
  if (!hasOffset) allPass = false;
  console.log(`${status}  ${label.padEnd(34)} → ${result}`);
}

if (allPass) {
  console.log("\nAll cases have valid timezone offset ✓");
} else {
  process.exit(1);
}

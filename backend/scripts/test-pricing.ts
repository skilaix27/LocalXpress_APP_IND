import { calculatePriceByDistance } from "../src/services/pricing";

const testCases: number[] = [2.5, 2.6, 7, 7.1, 120, 121];

// Edge-case validation tests
const invalidCases: Array<{ label: string; value: unknown }> = [
  { label: "NaN",       value: NaN },
  { label: "Infinity",  value: Infinity },
  { label: "zero",      value: 0 },
  { label: "-5",        value: -5 },
  { label: "string",    value: "10" as unknown },
];

console.log("=== Pricing zone tests ===\n");
for (const km of testCases) {
  try {
    const result = calculatePriceByDistance(km);
    console.log(`${km} km →`, JSON.stringify(result));
  } catch (e: any) {
    console.log(`${km} km → ERROR: ${e.message}`);
  }
}

console.log("\n=== Validation tests (all should throw) ===\n");
for (const { label, value } of invalidCases) {
  try {
    calculatePriceByDistance(value as number);
    console.log(`${label} → NO ERROR (unexpected)`);
  } catch (e: any) {
    console.log(`${label} → threw: ${e.message}`);
  }
}

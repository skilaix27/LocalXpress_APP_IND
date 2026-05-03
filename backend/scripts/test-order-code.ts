import { generatePublicOrderCode } from "../src/services/orderCode";

// Pattern: LXP-D{DD}{M}-P{NUMBER}
const CODE_REGEX = /^LXP-D\d{2}[A-Z]-P\d+$/;

async function main() {
  console.log("=== Order code generation test ===\n");

  const codes: string[] = [];

  for (let i = 0; i < 6; i++) {
    const code = await generatePublicOrderCode();
    console.log(`Code ${i + 1}: ${code}`);
    codes.push(code);
  }

  console.log();

  // 1. Format check
  for (const code of codes) {
    if (!CODE_REGEX.test(code)) {
      throw new Error(`Format error: "${code}" does not match LXP-D{DD}{M}-P{NUMBER}`);
    }
  }
  console.log("✓ All codes match format LXP-D{DD}{M}-P{NUMBER}");

  // 2. Uniqueness check
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    throw new Error(`Collision detected — ${codes.length - unique.size} duplicate(s) found`);
  }
  console.log("✓ No collisions — all codes are unique");

  // 3. First code of the run starts at P65 (if this is the first run today)
  const firstNumber = Number(codes[0].split("-P")[1]);
  if (firstNumber < 65) {
    throw new Error(`First code number ${firstNumber} is below the minimum of 65`);
  }
  console.log(`✓ First number: P${firstNumber} (>= 65)`);

  // 4. Each subsequent number must be strictly greater
  for (let i = 1; i < codes.length; i++) {
    const prev = Number(codes[i - 1].split("-P")[1]);
    const curr = Number(codes[i].split("-P")[1]);
    if (curr <= prev) {
      throw new Error(`Ordering error: code ${i + 1} (P${curr}) is not greater than code ${i} (P${prev})`);
    }
  }
  console.log("✓ Numbers are strictly increasing");

  console.log("\nOrder code generation test passed ✓");
}

main().catch((err) => {
  console.error("\nTest FAILED:", err.message);
  process.exit(1);
});

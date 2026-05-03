import dotenv from "dotenv";
import { calculateRouteDistance } from "../src/services/googleMaps";

dotenv.config({ quiet: true });

async function main() {
  const params = {
    pickup_address:   "Carrer Mallorca 120, Barcelona",
    delivery_address: "Carrer Balmes 55, Barcelona",
  };

  console.log("GOOGLE_MAPS_API_KEY present:", !!process.env.GOOGLE_MAPS_API_KEY);
  console.log("NODE_ENV:", process.env.NODE_ENV ?? "(not set — defaults to dev mock)");
  console.log("Input:", params);
  console.log();

  try {
    const result = await calculateRouteDistance(params);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main();

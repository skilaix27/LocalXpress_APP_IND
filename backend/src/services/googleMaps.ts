export interface RouteDistanceParams {
  pickup_address: string;
  delivery_address: string;
}

export interface RouteDistanceResult {
  distance_km: number;
  duration_minutes: number | null;
  distance_source: "google_maps" | "mock";
}

const ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

// Matches the buffer applied by the central LocalXpress app (useRouteDistance.ts).
// Applied to every route distance before returning, including the mock fallback.
export const ROUTE_DISTANCE_BUFFER_KM = 0.3;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Google Routes API v2 returns duration as "1234s"
function parseDurationSeconds(duration: string): number {
  const seconds = parseInt(duration.replace("s", ""), 10);
  return Number.isNaN(seconds) ? 0 : seconds;
}

function mockRoute(): RouteDistanceResult {
  const rawKm = round2(3 + Math.random() * 5); // 3–8 km raw
  const distance_km = Number((rawKm + ROUTE_DISTANCE_BUFFER_KM).toFixed(2));
  const duration_minutes = Math.round((rawKm / 30) * 60); // city avg 30 km/h
  console.warn("[googleMaps] No API key — returning mock distance for development.");
  return { distance_km, duration_minutes, distance_source: "mock" };
}

export async function calculateRouteDistance(
  params: RouteDistanceParams
): Promise<RouteDistanceResult> {
  const { pickup_address, delivery_address } = params;

  if (!pickup_address || pickup_address.trim() === "") {
    throw new Error("pickup_address is required.");
  }
  if (!delivery_address || delivery_address.trim() === "") {
    throw new Error("delivery_address is required.");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Google Maps API key is not configured.");
    }
    return mockRoute();
  }

  const requestBody = {
    origin:      { address: pickup_address.trim() },
    destination: { address: delivery_address.trim() },
    travelMode:        "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    routeModifiers:    { avoidTolls: true },
    languageCode:      "es",
    units:             "METRIC",
  };

  let response: Response;
  try {
    response = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-Goog-Api-Key":  apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    // Never log apiKey — log only the network error message
    console.error("[googleMaps] Network error:", (err as Error).message);
    throw new Error("Failed to reach Google Maps API. Please try again.");
  }

  if (!response.ok) {
    console.error(
      "[googleMaps] HTTP error from Routes API:",
      response.status,
      response.statusText
    );
    throw new Error(
      `Google Maps API returned an error (${response.status}). Please try again.`
    );
  }

  let data: { routes?: { distanceMeters?: number; duration?: string }[] };
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from Google Maps API.");
  }

  if (!data.routes || data.routes.length === 0) {
    throw new Error(
      "No route found between pickup and delivery addresses."
    );
  }

  const route = data.routes[0];
  const distanceMeters = route.distanceMeters ?? 0;
  const durationStr = route.duration ?? "0s";

  const distance_km = Number((distanceMeters / 1000 + ROUTE_DISTANCE_BUFFER_KM).toFixed(2));
  const duration_minutes = Math.round(parseDurationSeconds(durationStr) / 60);

  return { distance_km, duration_minutes, distance_source: "google_maps" };
}

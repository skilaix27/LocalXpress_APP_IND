export interface PricingZone {
  zone_name: string;
  min_km: number;
  max_km: number;
  price: number;
}

export interface PriceResult {
  distance_km: number;
  zone_name: string;
  price: number | null;
  manual_quote_required: boolean;
  price_driver: number | null;
  price_company: number | null;
}

export const PRICING_ZONES: PricingZone[] = [
  { zone_name: "Zona 1",  min_km: 0,   max_km: 2.5,  price: 8   },
  { zone_name: "Zona 2",  min_km: 2.5, max_km: 7,    price: 11  },
  { zone_name: "Zona 3",  min_km: 7,   max_km: 15,   price: 14  },
  { zone_name: "Zona 4",  min_km: 15,  max_km: 20,   price: 28  },
  { zone_name: "Zona 5",  min_km: 20,  max_km: 25,   price: 38  },
  { zone_name: "Zona 6",  min_km: 25,  max_km: 35,   price: 48  },
  { zone_name: "Zona 7",  min_km: 35,  max_km: 45,   price: 59  },
  { zone_name: "Zona 8",  min_km: 45,  max_km: 55,   price: 68  },
  { zone_name: "Zona 9",  min_km: 55,  max_km: 65,   price: 79  },
  { zone_name: "Zona 10", min_km: 65,  max_km: 75,   price: 89  },
  { zone_name: "Zona 11", min_km: 75,  max_km: 80,   price: 105 },
  { zone_name: "Zona 12", min_km: 80,  max_km: 100,  price: 120 },
  { zone_name: "Zona 13", min_km: 100, max_km: 120,  price: 145 },
];

// Matches the margin applied by the central LocalXpress app.
// Zone and price are always calculated on distance + this margin;
// the raw Google Maps distance is preserved for display and storage.
export const MARGIN_KM = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculatePriceByDistance(distanceKm: number): PriceResult {
  if (
    typeof distanceKm !== "number" ||
    Number.isNaN(distanceKm) ||
    !Number.isFinite(distanceKm)
  ) {
    throw new Error("distanceKm must be a finite number.");
  }
  if (distanceKm <= 0) {
    throw new Error("distanceKm must be greater than 0.");
  }

  // Apply margin only for zone/price lookup — raw distance is returned unchanged.
  const distanceForPricingKm = round2(distanceKm + MARGIN_KM);

  if (distanceForPricingKm > 120) {
    return {
      distance_km: distanceKm,
      zone_name: "Presupuesto personalizado",
      price: null,
      manual_quote_required: true,
      price_driver: null,
      price_company: null,
    };
  }

  // Boundary rule: min_km is exclusive, max_km is inclusive.
  // Zone 1 (min=0): distanceForPricingKm > 0 && distanceForPricingKm <= 2.5
  // Zone 2 (min=2.5): distanceForPricingKm > 2.5 && distanceForPricingKm <= 7
  // ...etc.
  const zone = PRICING_ZONES.find(
    (z) => distanceForPricingKm > z.min_km && distanceForPricingKm <= z.max_km
  );

  if (!zone) {
    throw new Error(`No pricing zone found for distance ${distanceForPricingKm} km (raw: ${distanceKm} km).`);
  }

  const price_driver = round2(zone.price * 0.7);
  const price_company = round2(zone.price - price_driver);

  return {
    distance_km: distanceKm,
    zone_name: zone.zone_name,
    price: zone.price,
    manual_quote_required: false,
    price_driver,
    price_company,
  };
}

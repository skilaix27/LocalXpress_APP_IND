import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Minimal ambient type — avoids requiring @types/google.maps
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

// ─── Script loader (singleton — loads once per page) ──────────────────────────

let _loadPromise: Promise<boolean> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<boolean> {
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload  = () => resolve(true);
    script.onerror = () => {
      _loadPromise = null;
      console.warn("[AddressAutocomplete] Failed to load Google Maps — using plain input.");
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return _loadPromise;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddressAutocompleteProps {
  id:              string;
  label:           string;
  value:           string;
  onChange:        (value: string) => void;
  onCoordinates?:  (lat: number, lng: number) => void;
  placeholder?:    string;
  error?:          string;
  className?:      string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  id,
  label,
  value,
  onChange,
  onCoordinates,
  placeholder,
  error,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey   = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    let active = true;

    loadGoogleMapsScript(apiKey).then((loaded) => {
      if (!loaded || !active || !inputRef.current) return;
      if (!window.google?.maps?.places?.Autocomplete) return;

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "es" },
        fields: ["formatted_address", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address);
          // Extract coordinates if available (only when user picks from dropdown)
          const lat = place.geometry?.location?.lat?.();
          const lng = place.geometry?.location?.lng?.();
          if (typeof lat === "number" && typeof lng === "number" && onCoordinates) {
            onCoordinates(lat, lng);
          }
        }
      });
    });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div>
      <Label htmlFor={id} className="text-sm md:text-base">
        {label}
      </Label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className ?? "h-11 md:h-10 text-base mt-1.5"}
        autoComplete="off"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

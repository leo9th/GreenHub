import { useEffect, useState } from "react";
import { searchAddressesNg, suggestMinQueryLength, type LocationSuggestion } from "../services/addressSearch";

/**
 * Debounced Nigeria-biased address suggestions (Mapbox when configured, else OSM).
 */
export function useDebouncedAddressSuggestions(query: string, debounceMs = 320) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const minLen = suggestMinQueryLength();

  useEffect(() => {
    const q = query.trim();
    if (q.length < minLen) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearching(true);
      void searchAddressesNg(q)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [query, debounceMs, minLen]);

  return { suggestions, searching, minLen };
}

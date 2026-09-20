import type { Hex } from '@/lib/api';

// Shade relative to the cells on screen: downtown is all in the city's top fifth, which would read as one flat colour.
// The city-wide band is stated in words under the map.
export const LEVEL_ALPHA = [0.08, 0.2, 0.34, 0.5, 0.68];
export function shader(hexes: Hex[]) {
  const vs = hexes.map((h) => h.value);
  const lo = Math.min(...vs);
  const span = Math.max(1, Math.max(...vs) - lo);
  return (h: Hex) => `rgba(54,119,131,${LEVEL_ALPHA[Math.min(4, Math.floor(((h.value - lo) / span) * 5))]})`;
}
export const LEVEL_LABEL = ['Lowest fifth', 'Low', 'Middle', 'High', 'Highest fifth'];

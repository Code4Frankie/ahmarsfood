// Pure functions (no env import) so they are easy to test.
// Fee = perKm for the first kilometre, then perKm again for every further kilometre or part of one.
// 0.4 km and 1.0 km cost 1 x perKm; 1.01 km costs 2 x perKm; 2.5 km costs 3 x perKm.
export function deliveryFeeFor(distanceKm, { perKm }) {
  const km = Math.round(distanceKm * 100) / 100; // ignore tiny rounding noise
  return perKm * Math.max(1, Math.ceil(km));
}

// Rough ETA: kitchen prep + riding at ~20 km/h + 5 min buffer.
export function estimateMinutes(distanceKm, prepMinutes = 15) {
  return Math.ceil(prepMinutes + (distanceKm / 20) * 60 + 5);
}

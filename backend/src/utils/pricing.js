// Pure functions (no env import) so they are easy to test.
// Fee = base + perKm x distance, rounded UP to the next N50.
export function deliveryFeeFor(distanceKm, { baseFee, perKm }) {
  const raw = baseFee + perKm * distanceKm;
  return Math.ceil(raw / 50) * 50;
}

// Rough ETA: kitchen prep + riding at ~20 km/h + 5 min buffer.
export function estimateMinutes(distanceKm, prepMinutes = 15) {
  return Math.ceil(prepMinutes + (distanceKm / 20) * 60 + 5);
}

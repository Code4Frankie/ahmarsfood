const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Same rule as the server: perKm for the first km, then perKm again for each further km or part of one.
// This is only a PREVIEW: the server recalculates the real fee when the order is placed.
export const feeFor = (km, { perKm }) => perKm * Math.max(1, Math.ceil(Math.round(km * 100) / 100));

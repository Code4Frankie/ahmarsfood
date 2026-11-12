const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Same rule as the server (base + perKm x distance, rounded up to N50). This is only a PREVIEW:
// the server recalculates the real fee when the order is placed.
export const feeFor = (km, { baseFee, perKm }) => Math.ceil((baseFee + perKm * km) / 50) * 50;

/** Mirror of public.redgo_is_in_service_area and place_delivery_order fees. */
export const serviceZones = [
  { id: "msaken", name: "M'Saken", latitude: 35.7273, longitude: 10.5815, radiusKm: 2.6 },
  { id: "messaadine", name: "Messaadine", latitude: 35.7551, longitude: 10.5921, radiusKm: 2.2 },
] as const;

export const deliveryFees = {
  firstStopMillimes: 2500,
  extraStopMillimes: 1000,
  serviceFeeMillimes: 500,
} as const;

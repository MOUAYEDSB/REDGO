import type { Coordinates } from '@redgo/shared';

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
};

export type RoadRoute = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchRoadRoute(waypoints: Coordinates[]): Promise<RoadRoute> {
  if (waypoints.length < 2) throw new Error('Il faut au moins deux points pour calculer un itinéraire.');

  const coordinateString = waypoints
    .map(({ latitude, longitude }) => `${longitude},${latitude}`)
    .join(';');
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=false`,
  );
  if (!response.ok) throw new Error(`Le service d'itinéraire est indisponible (${response.status}).`);

  const data = await response.json() as OsrmResponse;
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
    throw new Error("Aucun itinéraire routier n'a été trouvé.");
  }

  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

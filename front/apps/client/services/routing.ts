import type { Coordinates } from '@redgo/shared';

type OsrmManeuver = {
  type: string;
  modifier?: string;
  location: [number, number];
  bearing_before?: number;
  bearing_after?: number;
  exit?: number;
};

type OsrmStep = {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  name: string;
  mode: string;
  maneuver: OsrmManeuver;
};

type OsrmLeg = {
  distance: number;
  duration: number;
  summary: string;
  steps: OsrmStep[];
};

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs?: OsrmLeg[];
  }[];
};

export type RouteManeuver = {
  type: string;
  modifier?: string;
  location: Coordinates;
  bearingBefore?: number;
  bearingAfter?: number;
  exit?: number;
};

export type RouteStep = {
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  maneuver: RouteManeuver;
  instruction: string;
  coordinates: Coordinates[];
};

export type RoadRoute = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
};

/**
 * Traduit une manœuvre OSRM en instruction textuelle claire en français.
 */
export function formatOsrmInstruction(
  type: string,
  modifier?: string,
  name?: string,
  exit?: number
): string {
  const street = name && name.trim().length > 0 ? name.trim() : null;

  switch (type) {
    case 'depart':
      return street ? `Démarrer sur ${street}` : 'Démarrer votre trajet';

    case 'arrive':
      return street ? `Arrivée à ${street}` : 'Vous êtes arrivé à destination';

    case 'turn':
    case 'end of road':
      if (modifier === 'sharp right') {
        return street ? `Virage serré à droite sur ${street}` : 'Virage serré à droite';
      }
      if (modifier === 'right') {
        return street ? `Tourner à droite sur ${street}` : 'Tourner à droite';
      }
      if (modifier === 'slight right') {
        return street ? `Serrer à droite sur ${street}` : 'Serrer à droite';
      }
      if (modifier === 'straight') {
        return street ? `Continuer tout droit sur ${street}` : 'Continuer tout droit';
      }
      if (modifier === 'slight left') {
        return street ? `Serrer à gauche sur ${street}` : 'Serrer à gauche';
      }
      if (modifier === 'left') {
        return street ? `Tourner à gauche sur ${street}` : 'Tourner à gauche';
      }
      if (modifier === 'sharp left') {
        return street ? `Virage serré à gauche sur ${street}` : 'Virage serré à gauche';
      }
      if (modifier === 'uturn') {
        return 'Faire demi-tour';
      }
      return street ? `Tourner sur ${street}` : 'Tourner';

    case 'continue':
    case 'new name':
      if (modifier === 'uturn') return 'Faire demi-tour';
      return street ? `Continuer sur ${street}` : 'Continuer tout droit';

    case 'roundabout':
    case 'rotary':
      if (exit) {
        const exitStr = exit === 1 ? '1ère' : `${exit}e`;
        return street
          ? `Au rond-point, prendre la ${exitStr} sortie sur ${street}`
          : `Au rond-point, prendre la ${exitStr} sortie`;
      }
      return street ? `Au rond-point, continuer sur ${street}` : 'Prendre le rond-point';

    case 'roundabout turn':
      if (modifier === 'right') return 'Au rond-point, tourner à droite';
      if (modifier === 'left') return 'Au rond-point, tourner à gauche';
      return 'Au rond-point, continuer';

    case 'fork':
      if (modifier === 'right' || modifier === 'slight right') {
        return 'Prendre la bifurcation à droite';
      }
      if (modifier === 'left' || modifier === 'slight left') {
        return 'Prendre la bifurcation à gauche';
      }
      return 'Rester sur la voie';

    case 'merge':
      return street ? `Rejoindre ${street}` : 'Rejoindre la voie principale';

    case 'on ramp':
      return street ? `Prendre la bretelle d'accès vers ${street}` : "Prendre la bretelle d'accès";

    case 'off ramp':
      return street ? `Prendre la sortie vers ${street}` : 'Prendre la sortie';

    default:
      if (modifier === 'uturn') return 'Faire demi-tour';
      if (modifier === 'right') return street ? `Tourner à droite sur ${street}` : 'Tourner à droite';
      if (modifier === 'left') return street ? `Tourner à gauche sur ${street}` : 'Tourner à gauche';
      return street ? `Continuer sur ${street}` : 'Continuer tout droit';
  }
}

/**
 * Détermine le nom de l'icône Ionicons pour la manœuvre.
 */
export function getManeuverIconName(type?: string, modifier?: string): string {
  if (modifier === 'uturn') return 'arrow-undo';
  if (modifier === 'sharp right' || modifier === 'right') return 'arrow-forward';
  if (modifier === 'slight right') return 'arrow-up-outline';
  if (modifier === 'sharp left' || modifier === 'left') return 'arrow-back';
  if (modifier === 'slight left') return 'arrow-up-outline';
  if (type === 'arrive') return 'flag';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'sync';
  return 'arrow-up';
}

export async function fetchRoadRoute(waypoints: Coordinates[]): Promise<RoadRoute> {
  if (waypoints.length < 2) {
    throw new Error('Il faut au moins deux points pour calculer un itinéraire.');
  }

  const coordinateString = waypoints
    .map(({ latitude, longitude }) => `${longitude},${latitude}`)
    .join(';');

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=true`,
  );

  if (!response.ok) {
    throw new Error(`Le service d'itinéraire est indisponible (${response.status}).`);
  }

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
    throw new Error("Aucun itinéraire routier n'a été trouvé.");
  }

  const steps: RouteStep[] = [];

  if (route.legs && Array.isArray(route.legs)) {
    for (const leg of route.legs) {
      if (!leg.steps) continue;
      for (const step of leg.steps) {
        const stepCoords: Coordinates[] =
          step.geometry?.coordinates?.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          })) ?? [];

        const maneuverLoc: Coordinates = {
          latitude: step.maneuver.location[1],
          longitude: step.maneuver.location[0],
        };

        const instruction = formatOsrmInstruction(
          step.maneuver.type,
          step.maneuver.modifier,
          step.name,
          step.maneuver.exit
        );

        steps.push({
          distanceMeters: step.distance,
          durationSeconds: step.duration,
          name: step.name || '',
          instruction,
          maneuver: {
            type: step.maneuver.type,
            modifier: step.maneuver.modifier,
            location: maneuverLoc,
            bearingBefore: step.maneuver.bearing_before,
            bearingAfter: step.maneuver.bearing_after,
            exit: step.maneuver.exit,
          },
          coordinates: stepCoords,
        });
      }
    }
  }

  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps,
  };
}

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Map,
  Camera,
  Marker,
  GeoJSONSource,
  Layer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { colors } from '../constants/theme';
import { resolveBusinessCoordinates } from '../services/businessCoordinates';
import {
  fetchRoadRoute,
  getManeuverIconName,
  type RouteStep,
} from '../services/routing';

const MSAKEN_CENTER = { latitude: 35.7273, longitude: 10.5815 };
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type Point = { latitude: number; longitude: number };

type DriverMissionMapProps = {
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  pickupCoords?: Point | null;
  destinationCoords?: Point | null;
  restaurantName?: string | null;
  businessId?: string | null;
  height?: number;
  showExpandButton?: boolean;
  activeStep?: 'pickup' | 'delivery';
  onNavigateGoogleMaps?: () => void;
};

/**
 * Calcule le centre et le niveau de zoom optimal pour un ensemble de coordonnées.
 */
function getCameraForPoints(points: Point[]) {
  const longitudes = points.map((p) => p.longitude);
  const latitudes = points.map((p) => p.latitude);

  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);

  const span = Math.max(east - west, north - south);

  const zoom =
    span > 0.15 ? 10 :
    span > 0.08 ? 11 :
    span > 0.04 ? 12 :
    span > 0.015 ? 13 : 14;

  return {
    center: [(west + east) / 2, (south + north) / 2] as [number, number],
    zoom,
  };
}

/**
 * Calcule la distance en mètres entre deux coordonnées géographiques (Haversine).
 */
function getDistanceMeters(p1: Point, p2: Point): number {
  const R = 6371000;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Projette un point P sur un segment de droite [A, B] et renvoie la distance et le point projeté.
 */
function projectOnSegment(p: Point, a: Point, b: Point): { distance: number; projection: Point } {
  const cosLat = Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const dx = (b.longitude - a.longitude) * 111320 * cosLat;
  const dy = (b.latitude - a.latitude) * 110540;

  const px = (p.longitude - a.longitude) * 111320 * cosLat;
  const py = (p.latitude - a.latitude) * 110540;

  const segLengthSq = dx * dx + dy * dy;
  if (segLengthSq === 0) {
    const dist = Math.sqrt(px * px + py * py);
    return { distance: dist, projection: a };
  }

  let t = (px * dx + py * dy) / segLengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = t * dx;
  const projY = t * dy;

  const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  const projPoint: Point = {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };

  return { distance: dist, projection: projPoint };
}

/**
 * Trouve le segment de la polyline le plus proche du point donné.
 */
function findClosestSegment(point: Point, polyline: Point[]): {
  segmentIndex: number;
  distanceToRoute: number;
  projection: Point;
} {
  if (polyline.length < 2) {
    return {
      segmentIndex: 0,
      distanceToRoute: polyline.length === 1 ? getDistanceMeters(point, polyline[0]) : 0,
      projection: polyline[0] || point,
    };
  }

  let minDistance = Infinity;
  let bestIndex = 0;
  let bestProj = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const { distance, projection } = projectOnSegment(point, polyline[i], polyline[i + 1]);
    if (distance < minDistance) {
      minDistance = distance;
      bestIndex = i;
      bestProj = projection;
    }
  }

  return {
    segmentIndex: bestIndex,
    distanceToRoute: minDistance,
    projection: bestProj,
  };
}

/**
 * Calcule l'état de navigation réel : distance restante, durée et prochaine manœuvre.
 */
function computeRouteNavigationState(
  currentLocation: Point,
  routeCoords: Point[],
  steps: RouteStep[],
  totalDistanceMeters: number,
  totalDurationSeconds: number
) {
  if (routeCoords.length < 2) {
    return {
      remainingDistanceMeters: totalDistanceMeters,
      remainingDurationSeconds: totalDurationSeconds,
      nextStep: steps[0] || null,
      distanceToNextManeuver: totalDistanceMeters,
      isArrived: false,
      distanceToRoute: 0,
    };
  }

  // 1. Projeter la position GPS sur le tracé routier
  const { segmentIndex, distanceToRoute, projection } = findClosestSegment(currentLocation, routeCoords);

  // 2. Calculer la distance restante le long de la polyline depuis la projection
  let remainingMeters = getDistanceMeters(projection, routeCoords[segmentIndex + 1]);
  for (let i = segmentIndex + 1; i < routeCoords.length - 1; i++) {
    remainingMeters += getDistanceMeters(routeCoords[i], routeCoords[i + 1]);
  }

  // Ratio de durée restante estimée
  const durationRatio = totalDistanceMeters > 0 ? remainingMeters / totalDistanceMeters : 0;
  const remainingSeconds = Math.round(totalDurationSeconds * durationRatio);

  const isArrived = remainingMeters < 25;

  // 3. Identifier la prochaine manœuvre à venir
  let nextStep: RouteStep | null = null;
  let distToNextManeuver = remainingMeters;

  if (steps.length > 0) {
    for (let s = 1; s < steps.length; s++) {
      const step = steps[s];
      const mLoc = step.maneuver.location;
      const { segmentIndex: mSegIndex } = findClosestSegment(mLoc, routeCoords);

      if (mSegIndex > segmentIndex) {
        let dist = getDistanceMeters(projection, routeCoords[segmentIndex + 1]);
        for (let k = segmentIndex + 1; k < mSegIndex; k++) {
          dist += getDistanceMeters(routeCoords[k], routeCoords[k + 1]);
        }
        dist += getDistanceMeters(routeCoords[mSegIndex], mLoc);

        if (dist > 15) {
          nextStep = step;
          distToNextManeuver = Math.round(dist);
          break;
        }
      } else if (mSegIndex === segmentIndex) {
        const dist = getDistanceMeters(projection, mLoc);
        if (dist > 15) {
          nextStep = step;
          distToNextManeuver = Math.round(dist);
          break;
        }
      }
    }

    if (!nextStep) {
      nextStep = steps[steps.length - 1];
      distToNextManeuver = Math.round(remainingMeters);
    }
  }

  return {
    remainingDistanceMeters: Math.round(remainingMeters),
    remainingDurationSeconds: Math.max(0, remainingSeconds),
    nextStep,
    distanceToNextManeuver: distToNextManeuver,
    isArrived,
    distanceToRoute,
  };
}

function createCircle(center: Point, radiusMeters: number) {
  const coordinates: [number, number][] = [];
  const earthRadius = 6371000;

  for (let i = 0; i <= 48; i++) {
    const angle = (i * 2 * Math.PI) / 48;
    const latitudeOffset = (radiusMeters / earthRadius) * Math.cos(angle);
    const longitudeOffset =
      (radiusMeters / (earthRadius * Math.cos((center.latitude * Math.PI) / 180))) *
      Math.sin(angle);

    coordinates.push([
      center.longitude + (longitudeOffset * 180) / Math.PI,
      center.latitude + (latitudeOffset * 180) / Math.PI,
    ]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates],
    },
  };
}

export function DriverMissionMap({
  pickupAddress,
  destinationAddress,
  pickupCoords,
  destinationCoords,
  restaurantName,
  businessId,
  height = 230,
  showExpandButton = true,
  activeStep = 'delivery',
}: DriverMissionMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const lastRouteRequest = useRef<{ origin: Point; time: number } | null>(null);
  const offRouteCount = useRef<number>(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Position GPS réelle du chauffeur
  const [driverLocation, setDriverLocation] = useState<Point>(MSAKEN_CENTER);
  const [realSpeed, setRealSpeed] = useState<number>(0);
  const [realHeading, setRealHeading] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Itinéraire OSRM
  const [routeCoordinates, setRouteCoordinates] = useState<Point[]>([]);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [fullRouteCoords, setFullRouteCoords] = useState<Point[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  // Mode Guidage In-App & Affichage
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  const startPoint: Point = useMemo(() => {
    if (pickupCoords) return pickupCoords;
    return resolveBusinessCoordinates(businessId, restaurantName || pickupAddress);
  }, [pickupCoords, businessId, restaurantName, pickupAddress]);

  const endPoint: Point = useMemo(() => {
    if (destinationCoords) return destinationCoords;

    if (destinationAddress?.toLowerCase().includes('messaadine')) {
      return { latitude: 35.7551, longitude: 10.5921 };
    }

    return {
      latitude: MSAKEN_CENTER.latitude + 0.009,
      longitude: MSAKEN_CENTER.longitude + 0.006,
    };
  }, [destinationCoords, destinationAddress]);

  const activeDestination = activeStep === 'pickup' ? startPoint : endPoint;

  /**
   * Calcul du tracé routier avec OSRM.
   */
  const requestRoute = useCallback(
    async (origin: Point, force = false) => {
      const now = Date.now();
      const previous = lastRouteRequest.current;

      if (!force && previous) {
        const distance = getDistanceMeters(origin, previous.origin);
        // Évite de solliciter OSRM si déplacement < 30m ou requête trop récente (< 10s)
        if (now - previous.time < 10000 && distance < 30) {
          return;
        }
      }

      lastRouteRequest.current = { origin, time: now };
      setIsLoadingRoute(true);

      const activeWaypoints = [origin, activeDestination];
      const fullWaypoints =
        activeStep === 'pickup'
          ? [origin, startPoint, endPoint]
          : [origin, endPoint];

      try {
        const [activeRoute, fullRoute] = await Promise.all([
          fetchRoadRoute(activeWaypoints).catch(() => ({
            coordinates: activeWaypoints,
            distanceMeters: 1800,
            durationSeconds: 240,
            steps: [],
          })),
          fetchRoadRoute(fullWaypoints).catch(() => ({
            coordinates: fullWaypoints,
            distanceMeters: 3200,
            durationSeconds: 480,
            steps: [],
          })),
        ]);

        setRouteCoordinates(activeRoute.coordinates);
        setRouteSteps(activeRoute.steps || []);
        setFullRouteCoords(fullRoute.coordinates);
        setRouteDistanceMeters(activeRoute.distanceMeters);
        setRouteDurationSeconds(activeRoute.durationSeconds);
        setIsOffRoute(false);
        offRouteCount.current = 0;
      } catch {
        // En cas d'erreur réseau OSRM, garder les points existants
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [activeDestination, activeStep, startPoint, endPoint]
  );

  /**
   * Suivi GPS réel via expo-location (watchPositionAsync).
   * Aucun setInterval ni simulation : les mouvements proviennent à 100% du GPS.
   */
  useEffect(() => {
    let isMounted = true;

    async function initGpsWatcher() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (isMounted) setPermissionDenied(true);
          return;
        }

        if (isMounted) setPermissionDenied(false);

        // Position initiale immédiate
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          const pt = {
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
          };
          setDriverLocation(pt);
          if (initialLoc.coords.speed != null && initialLoc.coords.speed > 0) {
            setRealSpeed(Math.round(initialLoc.coords.speed * 3.6));
          }
          if (initialLoc.coords.heading != null && initialLoc.coords.heading >= 0) {
            setRealHeading(initialLoc.coords.heading);
          }
          setGpsAccuracy(initialLoc.coords.accuracy ?? null);
        }

        // Nettoyage de l'abonnement précédent s'il existe
        locationSubscriptionRef.current?.remove();

        // Abonnement GPS en direct haute précision
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: isNavigating
              ? Location.Accuracy.BestForNavigation
              : Location.Accuracy.High,
            timeInterval: isNavigating ? 1000 : 3000,
            distanceInterval: isNavigating ? 2 : 6,
          },
          (location) => {
            if (!isMounted) return;

            const currentPt: Point = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            const speedKmH =
              location.coords.speed != null && location.coords.speed > 0
                ? Math.round(location.coords.speed * 3.6)
                : 0;

            const headingVal =
              location.coords.heading != null && location.coords.heading >= 0
                ? location.coords.heading
                : null;

            setDriverLocation(currentPt);
            setRealSpeed(speedKmH);
            if (headingVal != null) setRealHeading(headingVal);
            setGpsAccuracy(location.coords.accuracy ?? null);

            // Suivi dynamique de caméra si en mode guidage actif
            if (isNavigating && !userInteracted) {
              cameraRef.current?.easeTo({
                center: [currentPt.longitude, currentPt.latitude],
                zoom: 17,
                pitch: 42,
                bearing: headingVal != null && speedKmH >= 4 ? headingVal : undefined,
                duration: 700,
              });
            }

            // Détection des écarts d'itinéraire (recouvrement si sortie de route > 45m)
            if (routeCoordinates.length > 1) {
              const { distanceToRoute } = findClosestSegment(currentPt, routeCoordinates);

              if (distanceToRoute > 45) {
                offRouteCount.current += 1;
                if (offRouteCount.current >= 2) {
                  setIsOffRoute(true);
                  void requestRoute(currentPt, true);
                }
              } else {
                offRouteCount.current = 0;
                if (isOffRoute) setIsOffRoute(false);
              }
            }
          }
        );
      } catch {
        // En cas d'erreur de capteur, conserver le point par défaut
      }
    }

    void initGpsWatcher();

    return () => {
      isMounted = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [isNavigating, userInteracted, routeCoordinates, requestRoute, isOffRoute]);

  // Initialisation ou mise à jour du tracé lors du changement de destination/étape
  useEffect(() => {
    void requestRoute(driverLocation, false);
  }, [activeDestination.latitude, activeDestination.longitude, activeStep, requestRoute, driverLocation]);

  // Calcul de la progression en direct le long du tracé
  const navState = useMemo(() => {
    return computeRouteNavigationState(
      driverLocation,
      routeCoordinates,
      routeSteps,
      routeDistanceMeters ?? 2400,
      routeDurationSeconds ?? 360
    );
  }, [driverLocation, routeCoordinates, routeSteps, routeDistanceMeters, routeDurationSeconds]);

  const pickupStreet = (
    restaurantName || pickupAddress || 'Point de retrait'
  ).split(',')[0].trim();

  const destStreet = (destinationAddress || 'Client').split(',')[0].trim();

  // Instruction textuelle en français basée sur la progression réelle
  const currentInstructionTitle = useMemo(() => {
    if (!isNavigating) return '';

    if (navState.isArrived) {
      return activeStep === 'pickup'
        ? `Arrivée à ${pickupStreet} !`
        : 'Arrivée chez le client !';
    }

    if (isOffRoute) {
      return 'Recalcul de l’itinéraire en cours…';
    }

    if (navState.nextStep) {
      if (navState.distanceToNextManeuver < 45) {
        return `Dans ${Math.max(10, navState.distanceToNextManeuver)} m, ${navState.nextStep.instruction.toLowerCase()}`;
      }
      return navState.nextStep.instruction;
    }

    return activeStep === 'pickup'
      ? `Vers ${pickupStreet} - Suivre l'itinéraire`
      : `Vers ${destStreet} - Suivre l'itinéraire`;
  }, [isNavigating, navState.isArrived, navState.nextStep, navState.distanceToNextManeuver, isOffRoute, activeStep, pickupStreet, destStreet]);

  const activeManeuverIcon = useMemo(() => {
    if (navState.isArrived) return 'flag';
    if (isOffRoute) return 'sync';
    if (navState.nextStep) {
      return getManeuverIconName(
        navState.nextStep.maneuver.type,
        navState.nextStep.maneuver.modifier
      );
    }
    return 'navigate';
  }, [navState.isArrived, isOffRoute, navState.nextStep]);

  // Données de distance et durée
  const currentDistanceMeters = navState.remainingDistanceMeters;
  const distanceKm = (currentDistanceMeters / 1000).toFixed(1);
  const durationMin = Math.max(1, Math.round(navState.remainingDurationSeconds / 60));

  // GeoJSON du trajet actif OSRM
  const activeRouteGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features:
        routeCoordinates.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: routeCoordinates.map(
                    (point): [number, number] => [point.longitude, point.latitude]
                  ),
                },
              },
            ]
          : [],
    }),
    [routeCoordinates]
  );

  // GeoJSON du trajet complet
  const fullRouteGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features:
        fullRouteCoords.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: fullRouteCoords.map(
                    (point): [number, number] => [point.longitude, point.latitude]
                  ),
                },
              },
            ]
          : [],
    }),
    [fullRouteCoords]
  );

  // GeoJSON des zones indicatives
  const zonesGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [createCircle(startPoint, 80), createCircle(endPoint, 80)],
    }),
    [startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude]
  );

  const centerMapOnRoute = () => {
    setUserInteracted(false);

    if (isNavigating) {
      cameraRef.current?.easeTo({
        center: [driverLocation.longitude, driverLocation.latitude],
        zoom: 17,
        pitch: 42,
        bearing: realHeading != null && realSpeed >= 4 ? realHeading : undefined,
        duration: 500,
      });
      return;
    }

    const points = [driverLocation, startPoint, endPoint, ...routeCoordinates];
    cameraRef.current?.easeTo({
      ...getCameraForPoints(points),
      duration: 600,
    });
  };

  const startInAppNavigation = () => {
    setIsNavigating(true);
    setIsExpanded(true);
    setUserInteracted(false);

    cameraRef.current?.easeTo({
      center: [driverLocation.longitude, driverLocation.latitude],
      zoom: 17,
      pitch: 42,
      bearing: realHeading != null ? realHeading : undefined,
      duration: 600,
    });
  };

  const stopInAppNavigation = () => {
    setIsNavigating(false);
    setUserInteracted(false);
    centerMapOnRoute();
  };

  const mapHeight = isNavigating ? 420 : isExpanded ? 360 : height;

  // Interface Web de secours
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height: mapHeight }]}>
        <View style={styles.webMapBg}>
          <View style={styles.webGridOverlay} />
          <View style={styles.webRouteLine} />

          <View style={[styles.webMarker, styles.webMarkerPickup]}>
            <Ionicons name="storefront" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>{pickupStreet}</Text>
          </View>

          <View style={[styles.webMarker, styles.webMarkerDriver]}>
            <Ionicons name="bicycle" size={16} color="#fff" />
          </View>

          <View style={[styles.webMarker, styles.webMarkerDest]}>
            <Ionicons name="flag" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>{destStreet}</Text>
          </View>
        </View>

        {isNavigating ? (
          <View style={styles.turnByTurnBanner}>
            <View style={styles.tbtIconCircle}>
              <Ionicons name={activeManeuverIcon as any} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tbtTitle} numberOfLines={1}>
                {currentInstructionTitle}
              </Text>
              <Text style={styles.tbtSub}>
                {realSpeed} km/h - {distanceKm} km restant - ~{durationMin} min
              </Text>
            </View>
            <Pressable onPress={stopInAppNavigation} style={styles.tbtCloseBtn}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.hudOverlay}>
            <View style={styles.metricPillGreen}>
              <Ionicons name="speedometer-outline" size={13} color="#fff" />
              <Text style={styles.metricPillTextWhite}>{distanceKm} km</Text>
            </View>
            <View style={styles.metricPillBlue}>
              <Ionicons name="time-outline" size={13} color="#fff" />
              <Text style={styles.metricPillTextWhite}>~{durationMin} min (Scooter)</Text>
            </View>
          </View>
        )}

        {!isNavigating ? (
          <Pressable
            accessibilityRole="button"
            onPress={startInAppNavigation}
            style={styles.googleMapsActionBar}
          >
            <View style={styles.googleMapsIconCircle}>
              <Ionicons name="navigate" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.googleMapsActionTitle}>
                {activeStep === 'pickup'
                  ? 'Guidage vers ' + pickupStreet
                  : 'Guidage vers ' + destStreet}
              </Text>
              <Text style={styles.googleMapsActionSub}>
                Démarrer le guidage GPS en direct sur la carte REDGO
              </Text>
            </View>
            <Ionicons name="play" size={16} color="#fff" />
          </Pressable>
        ) : null}

        <View style={styles.controlsOverlay}>
          {showExpandButton ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.controlBtn}
            >
              <Ionicons
                name={isExpanded ? 'contract' : 'expand'}
                size={16}
                color="#fff"
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const initialCenter: [number, number] = [
    (startPoint.longitude + endPoint.longitude) / 2,
    (startPoint.latitude + endPoint.latitude) / 2,
  ];

  return (
    <View style={[styles.container, { height: mapHeight }]}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: 13,
          }}
        />

        {/* Zones indicatives autour du retrait et de la livraison */}
        <GeoJSONSource id="mission-zones" data={zonesGeoJSON}>
          <Layer
            id="mission-zones-fill"
            source="mission-zones"
            type="fill"
            paint={{
              'fill-color': '#10B981',
              'fill-opacity': 0.1,
            }}
          />
          <Layer
            id="mission-zones-outline"
            source="mission-zones"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': '#10B981',
              'line-width': 1.5,
              'line-opacity': 0.55,
            }}
          />
        </GeoJSONSource>

        {/* Trajet complet de la mission */}
        {activeStep === 'pickup' && fullRouteCoords.length > 1 ? (
          <GeoJSONSource id="mission-full-route" data={fullRouteGeoJSON}>
            <Layer
              id="mission-full-route-line"
              source="mission-full-route"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': 'rgba(255, 32, 42, 0.45)',
                'line-width': 3,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {/* Trajet actif OSRM */}
        {routeCoordinates.length > 1 ? (
          <GeoJSONSource id="mission-active-route" data={activeRouteGeoJSON}>
            <Layer
              id="mission-active-route-line"
              source="mission-active-route"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': isOffRoute ? '#F59E0B' : colors.primary,
                'line-width': isNavigating ? 6 : 4.5,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {/* Restaurant ou point de retrait */}
        <Marker lngLat={[startPoint.longitude, startPoint.latitude]}>
          <View style={styles.markerPickupPin}>
            <Ionicons name="storefront" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Destination client */}
        <Marker lngLat={[endPoint.longitude, endPoint.latitude]}>
          <View style={styles.markerDestPin}>
            <Ionicons name="flag" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Position GPS réelle du chauffeur */}
        <Marker lngLat={[driverLocation.longitude, driverLocation.latitude]}>
          <View
            style={[
              styles.markerDriverPin,
              realHeading != null && isNavigating
                ? { transform: [{ rotate: `${realHeading}deg` }] }
                : undefined,
            ]}
          >
            <Ionicons name="bicycle" size={18} color="#fff" />
          </View>
        </Marker>
      </Map>

      {/* Alerte si permission GPS refusée */}
      {permissionDenied && (
        <View style={styles.permissionAlert}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.permissionAlertText}>
            Localisation requise pour le guidage GPS en direct.
          </Text>
        </View>
      )}

      {/* Bannière de guidage Turn-by-Turn GPS en direct */}
      {isNavigating ? (
        <View style={styles.turnByTurnBanner}>
          <View
            style={[
              styles.tbtIconCircle,
              isOffRoute && { backgroundColor: 'rgba(245, 158, 11, 0.4)' },
            ]}
          >
            <Ionicons name={activeManeuverIcon as any} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tbtTitle} numberOfLines={1}>
              {currentInstructionTitle}
            </Text>
            <Text style={styles.tbtSub} numberOfLines={1}>
              {navState.nextStep?.name ? `${navState.nextStep.name} · ` : ''}
              {realSpeed} km/h · {distanceKm} km restant · ~{durationMin} min
            </Text>
          </View>
          <Pressable onPress={stopInAppNavigation} style={styles.tbtCloseBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.hudOverlay}>
          <View style={styles.metricPillGreen}>
            <Ionicons name="speedometer-outline" size={13} color="#fff" />
            <Text style={styles.metricPillTextWhite}>{distanceKm} km</Text>
          </View>
          <View style={styles.metricPillBlue}>
            <Ionicons name="time-outline" size={13} color="#fff" />
            <Text style={styles.metricPillTextWhite}>~{durationMin} min (Scooter)</Text>
          </View>
          {gpsAccuracy != null && gpsAccuracy > 50 && (
            <View style={styles.metricPillAmber}>
              <Ionicons name="navigate-outline" size={12} color="#fff" />
              <Text style={styles.metricPillTextWhite}>GPS ±{Math.round(gpsAccuracy)}m</Text>
            </View>
          )}
        </View>
      )}

      {/* Action de lancement du guidage GPS REDGO */}
      {!isNavigating ? (
        <Pressable
          accessibilityRole="button"
          onPress={startInAppNavigation}
          style={styles.googleMapsActionBar}
        >
          <View style={styles.googleMapsIconCircle}>
            <Ionicons name="navigate" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.googleMapsActionTitle}>
              {activeStep === 'pickup'
                ? 'Démarrer le guidage vers ' + pickupStreet
                : 'Démarrer le guidage vers ' + destStreet}
            </Text>
            <Text style={styles.googleMapsActionSub}>
              Suivre le tracé GPS en direct sur la carte REDGO
            </Text>
          </View>
          <Ionicons name="play" size={17} color="#fff" />
        </Pressable>
      ) : null}

      {/* Contrôles de la carte */}
      <View style={styles.controlsOverlay}>
        <Pressable
          accessibilityRole="button"
          onPress={centerMapOnRoute}
          style={styles.controlBtn}
          accessibilityLabel="Recentrer sur le chauffeur"
        >
          <Ionicons name="locate" size={18} color="#fff" />
        </Pressable>

        {showExpandButton && !isNavigating ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.controlBtn}
            accessibilityLabel="Agrandir la carte"
          >
            <Ionicons
              name={isExpanded ? 'contract' : 'expand'}
              size={16}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>

      {isLoadingRoute ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262633',
    backgroundColor: '#121217',
    position: 'relative',
    marginBottom: 14,
  },
  loaderWrap: {
    position: 'absolute',
    top: 55,
    left: 10,
    backgroundColor: 'rgba(18,18,23,0.85)',
    borderRadius: 8,
    padding: 6,
    zIndex: 12,
  },
  permissionAlert: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 25,
  },
  permissionAlertText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  hudOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
  },
  metricPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metricPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metricPillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricPillTextWhite: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Bannière Turn-by-Turn en direct (Guidage In-App)
  turnByTurnBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.97)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  tbtIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbtTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  tbtSub: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tbtCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Barre d'action guidage
  googleMapsActionBar: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 115,
    backgroundColor: 'rgba(18, 20, 29, 0.95)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  googleMapsIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMapsActionTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  googleMapsActionSub: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
  },

  controlsOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 10,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(24, 24, 30, 0.92)',
    borderWidth: 1,
    borderColor: '#3F3F4E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pins natifs
  markerPickupPin: {
    backgroundColor: '#10B981',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  markerDestPin: {
    backgroundColor: colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  markerDriverPin: {
    backgroundColor: '#1E40AF',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#60A5FA',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },

  // Fallback Web
  webMapBg: {
    flex: 1,
    backgroundColor: '#16181F',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  webGridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.15,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  webRouteLine: {
    position: 'absolute',
    width: '60%',
    height: 4,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-18deg' }],
    borderRadius: 2,
  },
  webMarker: {
    position: 'absolute',
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
  },
  webMarkerPickup: {
    backgroundColor: '#10B981',
    top: '28%',
    left: '16%',
  },
  webMarkerDriver: {
    backgroundColor: '#1D4ED8',
    top: '42%',
    left: '46%',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
  },
  webMarkerDest: {
    backgroundColor: colors.primary,
    bottom: '30%',
    right: '16%',
  },
  webMarkerLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
    maxWidth: 90,
    textAlign: 'center',
  },
});

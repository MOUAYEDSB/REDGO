import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { colors } from '../constants/theme';
import { resolveBusinessCoordinates } from '../services/businessCoordinates';
import { publishDriverLocation } from '../services/driverLocation';
import { fetchMissionLocationDetails } from '../services/driverMissions';
import { RestaurantMapMarkers } from './RestaurantMapMarkers';
import {
  fetchRoadRoute,
  getManeuverIconName,
  type RouteStep,
} from '../services/routing';

const MSAKEN_CENTER = { latitude: 35.7273, longitude: 10.5815 };
const LOCAL_LANDMARKS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; latitude: number; longitude: number }[] = [
  { id: 'msaken_centre', label: "M'Saken Centre", icon: 'business', latitude: 35.7273, longitude: 10.5815 },
  { id: 'gare_msaken', label: "Gare M'Saken", icon: 'train', latitude: 35.7298, longitude: 10.5792 },
  { id: 'hopital_msaken', label: "Hôpital M'Saken", icon: 'medkit', latitude: 35.7215, longitude: 10.5862 },
  { id: 'messaadine_centre', label: 'Messaadine', icon: 'location', latitude: 35.7551, longitude: 10.5921 },
];
const canRenderNativeMap =
  Platform.OS === 'ios' || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

type Point = { latitude: number; longitude: number };

type DriverMissionMapProps = {
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  pickupCoords?: Point | null;
  destinationCoords?: Point | null;
  restaurantName?: string | null;
  businessId?: string | null;
  missionType?: 'delivery' | 'scooter_ride';
  height?: number;
  showExpandButton?: boolean;
  activeStep?: 'pickup' | 'delivery';
  orderId?: string | null;
  driverId?: string | null;
  onNavigateGoogleMaps?: () => void;
};

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
 * Calcule la distance restante le long de la polyline à partir de la projection courante.
 */
function computeRemainingMeters(
  currentPos: Point,
  polyline: Point[],
  closest: { segmentIndex: number; projection: Point }
): number {
  if (polyline.length < 2) return 0;

  let total = getDistanceMeters(currentPos, closest.projection);

  const nextVertex = polyline[closest.segmentIndex + 1];
  if (nextVertex) {
    total += getDistanceMeters(closest.projection, nextVertex);
  }

  for (let i = closest.segmentIndex + 1; i < polyline.length - 1; i++) {
    total += getDistanceMeters(polyline[i], polyline[i + 1]);
  }

  return Math.round(total);
}

/**
 * Identifie la prochaine étape OSRM à franchir.
 */
function findUpcomingStep(
  driverLoc: Point,
  steps: RouteStep[]
): { step: RouteStep | null; distanceToManeuver: number } {
  if (!steps || steps.length === 0) {
    return { step: null, distanceToManeuver: 0 };
  }

  for (const step of steps) {
    const dist = getDistanceMeters(driverLoc, step.maneuver.location);
    if (dist > 15) {
      return { step, distanceToManeuver: Math.round(dist) };
    }
  }

  const lastStep = steps[steps.length - 1];
  return {
    step: lastStep,
    distanceToManeuver: Math.round(getDistanceMeters(driverLoc, lastStep.maneuver.location)),
  };
}

export function DriverMissionMap({
  pickupAddress,
  destinationAddress,
  pickupCoords,
  destinationCoords,
  restaurantName,
  businessId,
  missionType = 'delivery',
  height = 400,
  showExpandButton = true,
  activeStep = 'delivery',
  orderId = null,
  driverId = null,
}: DriverMissionMapProps) {
  const mapRef = useRef<MapView>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const offRouteCount = useRef(0);
  const lastRecalcTimestamp = useRef(0);
  const lastPublishTimestamp = useRef(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Positions géographiques
  const [driverLocation, setDriverLocation] = useState<Point>(MSAKEN_CENTER);
  const [realHeading, setRealHeading] = useState<number | null>(null);
  const [realSpeed, setRealSpeed] = useState<number>(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Données de tracé OSRM
  const [routeCoordinates, setRouteCoordinates] = useState<Point[]>([]);
  const [abRouteCoordinates, setAbRouteCoordinates] = useState<Point[]>([]);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number | null>(null);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number | null>(null);
  const [resolvedRemoteCoords, setResolvedRemoteCoords] = useState<{
    pickupCoords: Point | null;
    destinationCoords: Point | null;
    restaurantName: string | null;
  } | null>(null);

  useEffect(() => {
    if (!orderId || (pickupCoords && destinationCoords)) return;
    let active = true;
    fetchMissionLocationDetails(orderId)
      .then((details) => {
        if (!active) return;
        setResolvedRemoteCoords({
          pickupCoords: details.pickupCoords,
          destinationCoords: details.destinationCoords,
          restaurantName: details.restaurantName,
        });
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [orderId, pickupCoords, destinationCoords]);

  // État de l'interface & navigation
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  // Détermination du point de retrait (Point A : restaurant, commerce ou départ scooter/colis)
  const startPoint: Point = useMemo(() => {
    if (pickupCoords) return pickupCoords;
    if (resolvedRemoteCoords?.pickupCoords) return resolvedRemoteCoords.pickupCoords;
    return resolveBusinessCoordinates(businessId, restaurantName || resolvedRemoteCoords?.restaurantName || pickupAddress);
  }, [pickupCoords, resolvedRemoteCoords, businessId, restaurantName, pickupAddress]);

  // Détermination du point de livraison (Point B : client / arrivée)
  const endPoint: Point = useMemo(() => {
    if (destinationCoords) return destinationCoords;
    if (resolvedRemoteCoords?.destinationCoords) return resolvedRemoteCoords.destinationCoords;
    if (destinationAddress?.toLowerCase().includes('messaadine')) {
      return { latitude: 35.7551, longitude: 10.5921 };
    }
    return {
      latitude: MSAKEN_CENTER.latitude + 0.009,
      longitude: MSAKEN_CENTER.longitude + 0.006,
    };
  }, [destinationCoords, resolvedRemoteCoords, destinationAddress]);

  // Cible active selon l'étape de la mission
  const activeDestination = activeStep === 'pickup' ? startPoint : endPoint;

  // Région initiale centrée sur le point de départ
  const initialRegion: Region = useMemo(
    () => ({
      latitude: MSAKEN_CENTER.latitude,
      longitude: MSAKEN_CENTER.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    }),
    []
  );

  /**
   * Calcul ou recalcul d'itinéraire OSRM réel avec étapes détaillées
   */
  const requestRoute = useCallback(
    async (origin: Point, isRecalc = false) => {
      const now = Date.now();
      if (isRecalc && now - lastRecalcTimestamp.current < 7000) {
        return;
      }
      lastRecalcTimestamp.current = now;

      setIsLoadingRoute(true);
      try {
        const waypoints = [origin, activeDestination];
        const routeData = await fetchRoadRoute(waypoints);

        if (routeData && routeData.coordinates.length > 0) {
          setRouteCoordinates(routeData.coordinates);
          setRouteSteps(routeData.steps || []);
          setTotalDistanceMeters(routeData.distanceMeters);
          setTotalDurationSeconds(routeData.durationSeconds);
          setIsOffRoute(false);
          offRouteCount.current = 0;
        }
      } catch {
        const directDist = Math.round(getDistanceMeters(origin, activeDestination));
        setRouteCoordinates([origin, activeDestination]);
        setTotalDistanceMeters(directDist);
        setTotalDurationSeconds(Math.max(60, Math.round(directDist / 7.5)));
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [activeDestination]
  );

  /**
   * Gestion du cycle de vie du suivi GPS réel
   */
  useEffect(() => {
    let isMounted = true;

    async function initGpsWatcher() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setGpsPermissionDenied(true);
          return;
        }
        if (isMounted) setGpsPermissionDenied(false);

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

          if (orderId || driverId) {
            lastPublishTimestamp.current = Date.now();
            void publishDriverLocation({
              orderId,
              driverId,
              latitude: pt.latitude,
              longitude: pt.longitude,
              heading: initialLoc.coords.heading ?? null,
            });
          }
        }

        locationSubscriptionRef.current?.remove();

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

            // Diffusion de la position GPS réelle vers le client (toutes les 3s max)
            const nowMs = Date.now();
            if ((orderId || driverId) && nowMs - lastPublishTimestamp.current >= 3000) {
              lastPublishTimestamp.current = nowMs;
              void publishDriverLocation({
                orderId,
                driverId,
                latitude: currentPt.latitude,
                longitude: currentPt.longitude,
                heading: headingVal,
              });
            }

            if (isNavigating && !userInteracted) {
              mapRef.current?.animateCamera({
                center: currentPt,
                pitch: 45,
                heading: headingVal != null && speedKmH >= 3 ? headingVal : 0,
                zoom: 17,
              });
            }

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
        // En cas d'erreur de capteur
      }
    }

    void initGpsWatcher();

    return () => {
      isMounted = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [isNavigating, userInteracted, routeCoordinates, requestRoute, isOffRoute, orderId, driverId]);

  useEffect(() => {
    void requestRoute(driverLocation, false);
  }, [activeDestination.latitude, activeDestination.longitude, activeStep, requestRoute, driverLocation]);

  // Tracé complet Point A -> Point B toujours visible pour le chauffeur
  useEffect(() => {
    let active = true;
    fetchRoadRoute([startPoint, endPoint])
      .then((res) => {
        if (!active) return;
        if (res?.coordinates?.length > 1) {
          setAbRouteCoordinates(res.coordinates);
        } else {
          setAbRouteCoordinates([startPoint, endPoint]);
        }
      })
      .catch(() => {
        if (active) setAbRouteCoordinates([startPoint, endPoint]);
      });
    return () => {
      active = false;
    };
  }, [startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude]);

  // Ajuster automatiquement la caméra pour afficher les 2 points (A et B) + chauffeur
  useEffect(() => {
    if (isNavigating || userInteracted) return;
    const pts = [startPoint, endPoint, driverLocation];
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 75, right: 45, bottom: 95, left: 45 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude, isNavigating, userInteracted]);

  const remainingDistanceMeters = useMemo(() => {
    if (routeCoordinates.length < 2) return totalDistanceMeters ?? 0;
    const closest = findClosestSegment(driverLocation, routeCoordinates);
    return computeRemainingMeters(driverLocation, routeCoordinates, closest);
  }, [driverLocation, routeCoordinates, totalDistanceMeters]);

  const upcomingManeuver = useMemo(() => {
    return findUpcomingStep(driverLocation, routeSteps);
  }, [driverLocation, routeSteps]);

  const centerMapOnRoute = useCallback(() => {
    setUserInteracted(false);
    if (isNavigating) {
      mapRef.current?.animateCamera({
        center: driverLocation,
        pitch: 45,
        heading: realHeading ?? 0,
        zoom: 17,
      });
    } else {
      const allPts = [startPoint, endPoint, driverLocation, ...abRouteCoordinates, ...routeCoordinates];
      mapRef.current?.fitToCoordinates(allPts, {
        edgePadding: { top: 75, right: 45, bottom: 95, left: 45 },
        animated: true,
      });
    }
  }, [isNavigating, driverLocation, realHeading, routeCoordinates, abRouteCoordinates, startPoint, endPoint]);

  const formattedDistance =
    remainingDistanceMeters >= 1000
      ? `${(remainingDistanceMeters / 1000).toFixed(1)} km`
      : `${remainingDistanceMeters} m`;

  const remainingDurationSeconds = useMemo(() => {
    if (totalDurationSeconds && totalDistanceMeters && totalDistanceMeters > 0) {
      return Math.max(30, Math.round(totalDurationSeconds * (remainingDistanceMeters / totalDistanceMeters)));
    }
    return Math.max(60, Math.round(remainingDistanceMeters / 7.5));
  }, [totalDurationSeconds, totalDistanceMeters, remainingDistanceMeters]);

  const formattedEta =
    remainingDurationSeconds < 60
      ? '< 1 min'
      : `${Math.ceil(remainingDurationSeconds / 60)} min`;

  const etaClock = useMemo(() => {
    const arrival = new Date(Date.now() + remainingDurationSeconds * 1000);
    return `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`;
  }, [remainingDurationSeconds]);

  const formattedManeuverDist =
    upcomingManeuver.distanceToManeuver >= 1000
      ? `${(upcomingManeuver.distanceToManeuver / 1000).toFixed(1)} km`
      : `${upcomingManeuver.distanceToManeuver} m`;

  const activeManeuverIcon = upcomingManeuver.step
    ? getManeuverIconName(
      upcomingManeuver.step.maneuver.type,
      upcomingManeuver.step.maneuver.modifier
    )
    : 'navigate';

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.85],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={[styles.container, { height: isExpanded ? 580 : height }]}>
      {canRenderNativeMap ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          userInterfaceStyle="dark"
          showsBuildings
          showsTraffic={false}
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
          onPanDrag={() => {
            if (isNavigating) setUserInteracted(true);
          }}
        >
          {/* Repères locaux M'Saken & Messaadine pour une vue claire */}
          {LOCAL_LANDMARKS.map((lm) => (
            <Marker
              key={lm.id}
              coordinate={{ latitude: lm.latitude, longitude: lm.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={1}
            >
              <View style={styles.landmarkPill}>
                <Ionicons name={lm.icon} size={10} color="#CBD5E1" />
                <Text style={styles.landmarkText}>{lm.label}</Text>
              </View>
            </Marker>
          ))}

          {/* Restaurants & Hub Courses visibles sur la carte */}
          <RestaurantMapMarkers />

          {/* Itinéraire complet Point A -> Point B */}
          {abRouteCoordinates.length > 1 && (
            <>
              <Polyline
                coordinates={abRouteCoordinates}
                strokeColor="rgba(255, 32, 42, 0.28)"
                strokeWidth={10}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                coordinates={abRouteCoordinates}
                strokeColor={colors.primary}
                strokeWidth={4.5}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )}

          {/* Approche GPS du chauffeur vers la cible active */}
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#10B981"
              strokeWidth={3.5}
              lineDashPattern={[8, 6]}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Point A : Restaurant / Commerce / Départ */}
          <Marker
            coordinate={startPoint}
            title={`Point A · ${restaurantName || resolvedRemoteCoords?.restaurantName || pickupAddress || 'Départ'}`}
            description={missionType === 'scooter_ride' ? 'Point de départ client' : 'Retrait commande'}
            anchor={{ x: 0.5, y: 0.85 }}
          >
            <View style={styles.markerWithBadge}>
              <View style={styles.markerLabelPillGreen}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  A · {restaurantName || resolvedRemoteCoords?.restaurantName || (missionType === 'scooter_ride' ? 'Départ' : 'Restaurant')}
                </Text>
              </View>
              <View style={styles.markerPickupPin}>
                <Ionicons
                  name={
                    destinationAddress?.startsWith('[COLIS')
                      ? 'cube'
                      : missionType === 'scooter_ride'
                        ? 'bicycle'
                        : (pickupAddress?.toLowerCase().includes('courses') ? 'basket' : 'restaurant')
                  }
                  size={16}
                  color="#fff"
                />
              </View>
            </View>
          </Marker>

          {/* Point B : Destination / Client */}
          <Marker
            coordinate={endPoint}
            title={`Point B · ${destinationAddress || 'Destination'}`}
            description="Point d'arrivée"
            anchor={{ x: 0.5, y: 0.85 }}
          >
            <View style={styles.markerWithBadge}>
              <View style={styles.markerLabelPillRed}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  B · Arrivée
                </Text>
              </View>
              <View style={styles.markerDestPin}>
                <Ionicons name="flag" size={15} color="#fff" />
              </View>
            </View>
          </Marker>

          <Marker
            coordinate={driverLocation}
            title="Votre position GPS"
            description={
              realSpeed > 0
                ? `${realSpeed} km/h · Précision : ${gpsAccuracy ? Math.round(gpsAccuracy) : '--'}m`
                : 'À l’arrêt'
            }
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={realHeading != null ? realHeading : 0}
          >
            <View style={styles.driverMarkerWrap}>
              <Animated.View
                style={[
                  styles.driverPulseRing,
                  { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                ]}
              />
              <View style={styles.markerDriverPin}>
                <Ionicons name="bicycle" size={17} color="#fff" />
              </View>
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.fallbackMapBg}>
          <View style={styles.fallbackRouteCard}>
            <View style={styles.fallbackRouteRow}>
              <Ionicons name="radio-button-on" size={14} color={colors.success} />
              <Text style={styles.fallbackRouteAddr} numberOfLines={1}>
                {restaurantName || pickupAddress || 'Point de départ'}
              </Text>
            </View>
            <View style={styles.fallbackRouteDivider} />
            <View style={styles.fallbackRouteRow}>
              <Ionicons name="flag" size={14} color={colors.primary} />
              <Text style={styles.fallbackRouteAddr} numberOfLines={1}>
                {destinationAddress || 'Destination client'}
              </Text>
            </View>
          </View>
          <Text style={styles.fallbackMapText}>
            {formattedDistance} · ~{formattedEta} (Arrivée {etaClock})
          </Text>
        </View>
      )}

      {gpsPermissionDenied ? (
        <View style={styles.permissionAlert}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.permissionAlertText}>
            GPS désactivé. Veuillez autoriser la localisation pour le guidage.
          </Text>
        </View>
      ) : null}

      {!isNavigating ? (
        <View style={styles.hudOverlay}>
          <View style={styles.metricPillGreen}>
            <Ionicons name="navigate-circle" size={13} color="#fff" />
            <Text style={styles.metricPillTextWhite}>
              {activeStep === 'pickup' ? 'Collecte' : 'Client'} : {formattedDistance} · ~{formattedEta}
            </Text>
          </View>
          <View style={styles.metricPillDark}>
            <Ionicons name="time-outline" size={12} color="#fff" />
            <Text style={styles.metricPillTextWhite}>Arrivée {etaClock}</Text>
          </View>
          {realSpeed > 0 ? (
            <View style={styles.metricPillBlue}>
              <Ionicons name="speedometer" size={12} color="#fff" />
              <Text style={styles.metricPillTextWhite}>{realSpeed} km/h</Text>
            </View>
          ) : gpsAccuracy != null ? (
            <View style={styles.metricPillDark}>
              <Ionicons name="locate" size={11} color={colors.success} />
              <Text style={styles.metricPillTextWhite}>GPS ±{Math.round(gpsAccuracy)}m</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {isNavigating ? (
        <View style={styles.turnByTurnBanner}>
          <View style={styles.tbtIconCircle}>
            <Ionicons name={activeManeuverIcon as any} size={20} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.tbtTitle} numberOfLines={1}>
              {isOffRoute
                ? 'Recalcul de l’itinéraire…'
                : upcomingManeuver.step?.instruction || 'Continuer tout droit'}
            </Text>
            <Text style={styles.tbtSub} numberOfLines={1}>
              {isOffRoute
                ? 'Écart par rapport à l’itinéraire détecté'
                : `Dans ${formattedManeuverDist} · ${formattedDistance} · ~${formattedEta} (${etaClock}) · ${realSpeed} km/h`}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitter le guidage"
            onPress={() => setIsNavigating(false)}
            style={styles.tbtCloseBtn}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {!isNavigating ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setIsNavigating(true);
            setUserInteracted(false);
            centerMapOnRoute();
          }}
          style={styles.googleMapsActionBar}
        >
          <View style={styles.googleMapsIconCircle}>
            <Ionicons name="navigate" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.googleMapsActionTitle}>Démarrer le guidage GPS en direct</Text>
            <Text style={styles.googleMapsActionSub}>
              Suivi temps réel et instructions virage par virage
            </Text>
          </View>
          <Ionicons name="play" size={17} color="#fff" />
        </Pressable>
      ) : null}

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
              size={18}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: '#2A2A38',
    position: 'relative',
    marginVertical: 10,
  },
  fallbackMapBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#16181F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackMapText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '800',
  },
  fallbackRouteCard: {
    width: '86%',
    backgroundColor: 'rgba(25, 25, 25, 0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#292929',
    padding: 10,
    marginBottom: 4,
  },
  fallbackRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackRouteDivider: {
    width: 2,
    height: 10,
    backgroundColor: '#292929',
    marginLeft: 6,
    marginVertical: 2,
  },
  fallbackRouteAddr: {
    color: '#F4F4F5',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  metricPillDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    borderWidth: 1,
    borderColor: '#292929',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingRouteBadge: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(24, 24, 32, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3D3D4E',
    zIndex: 15,
  },
  loadingRouteText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
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
  metricPillTextWhite: { color: '#fff', fontSize: 11, fontWeight: '800' },
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
  landmarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  landmarkText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
  },
  markerWithBadge: {
    alignItems: 'center',
    gap: 3,
  },
  markerLabelPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.94)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 130,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  markerLabelPillRed: {
    backgroundColor: 'rgba(255, 32, 42, 0.94)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 110,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  markerLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
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
  driverMarkerWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  markerDriverPin: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});

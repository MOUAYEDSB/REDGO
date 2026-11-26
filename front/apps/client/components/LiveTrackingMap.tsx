import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchRoadRoute } from '../services/routing';
import { Coordinates, DeliveryStop, DriverInfo } from '../types/delivery';
import { RestaurantMapMarkers } from './RestaurantMapMarkers';

const canRenderNativeMap =
  Platform.OS === 'ios' || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

type LiveTrackingMapProps = {
  customerLocation: Coordinates;
  customerAddress?: string;
  driver: DriverInfo | null;
  driverLocation?: Coordinates | null;
  pickupStops?: DeliveryStop[];
  height?: number;
  onRouteStatus?: (message: string) => void;
};

/**
 * Calcule la distance Haversine en mètres entre deux points GPS.
 */
function getDistanceMeters(p1: Coordinates, p2: Coordinates): number {
  const R = 6371000;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcule le cap (bearing en degrés 0-360) entre deux coordonnées GPS.
 */
function computeBearing(from: Coordinates, to: Coordinates): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function LiveTrackingMap({
  customerLocation,
  customerAddress,
  driver,
  driverLocation,
  pickupStops = [],
  height = 360,
  onRouteStatus,
}: LiveTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const lastRouteRequest = useRef<{ origin: Coordinates; time: number } | null>(null);
  const previousDriverCoord = useRef<Coordinates | null>(null);

  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const [routeStatusState, setRouteStatusState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [routeMessage, setRouteMessage] = useState('En attente de la position GPS réelle du livreur.');

  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [followDriver, setFollowDriver] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [sheetCollapsed, setSheetCollapsed] = useState<boolean>(false);

  const activeDriverLocation = driverLocation ?? driver?.currentLocation ?? null;
  const [liveScooterCoords, setLiveScooterCoords] = useState<Coordinates | null>(activeDriverLocation);

  // Animations natives fluides (60 FPS)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0.15)).current;

  // Animation de pulsation radar continue pour le scooter & le voyant LIVE
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

  // Synchronisation avec la position GPS réelle + calcul de direction (bearing) + suivi caméra
  useEffect(() => {
    if (!activeDriverLocation) return;

    if (previousDriverCoord.current) {
      const movedMeters = getDistanceMeters(previousDriverCoord.current, activeDriverLocation);
      if (movedMeters > 3) {
        const nextBearing = computeBearing(previousDriverCoord.current, activeDriverLocation);
        setDriverHeading(nextBearing);
      }
    }
    previousDriverCoord.current = activeDriverLocation;
    setLiveScooterCoords(activeDriverLocation);

    if (followDriver && canRenderNativeMap) {
      mapRef.current?.animateCamera(
        {
          center: activeDriverLocation,
          zoom: 16,
          pitch: 35,
          heading: driverHeading,
        },
        { duration: 650 }
      );
    }
  }, [activeDriverLocation?.latitude, activeDriverLocation?.longitude, followDriver, driverHeading]);

  // Progression visuelle animée selon l'avancement des arrêts et la distance restante
  useEffect(() => {
    const totalStops = pickupStops.length;
    const completedStops = pickupStops.filter((s) => s.status === 'completed').length;

    let ratio = 0.2;
    if (!activeDriverLocation) {
      ratio = 0.1;
    } else if (routeDistanceMeters !== null) {
      const distProgress = Math.max(0, Math.min(1, 1 - routeDistanceMeters / 4500));
      const stopBonus = totalStops > 0 ? (completedStops / totalStops) * 0.45 : 0.25;
      ratio = Math.max(0.15, Math.min(0.96, stopBonus + distProgress * 0.55));
    }

    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeDriverLocation, pickupStops, routeDistanceMeters, progressAnim]);

  const toggleSheet = useCallback(() => {
    const next = !sheetCollapsed;
    setSheetCollapsed(next);
    Animated.timing(sheetAnim, {
      toValue: next ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sheetCollapsed, sheetAnim]);

  const initialRegion: Region = useMemo(
    () => ({
      latitude: activeDriverLocation?.latitude ?? customerLocation.latitude,
      longitude: activeDriverLocation?.longitude ?? customerLocation.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }),
    [activeDriverLocation?.latitude, activeDriverLocation?.longitude, customerLocation.latitude, customerLocation.longitude]
  );

  const routeWaypoints = useMemo(() => {
    if (!activeDriverLocation) return [];
    return [
      activeDriverLocation,
      ...pickupStops.filter((stop) => stop.status !== 'completed').map((stop) => stop.location),
      customerLocation,
    ];
  }, [activeDriverLocation, customerLocation, pickupStops]);

  const routeKey = routeWaypoints
    .map(({ latitude, longitude }) => `${latitude.toFixed(5)},${longitude.toFixed(5)}`)
    .join(';');

  // Calcul OSRM réel avec anti-spam (15s / 30m)
  useEffect(() => {
    let active = true;
    if (routeWaypoints.length < 2) {
      setRouteCoordinates([]);
      setRouteDistanceMeters(null);
      setRouteDurationSeconds(null);
      setRouteStatusState('idle');
      const msg = 'En attente de la position GPS réelle du livreur.';
      setRouteMessage(msg);
      onRouteStatus?.(msg);
      return () => {
        active = false;
      };
    }

    const now = Date.now();
    const origin = routeWaypoints[0];
    const previousRequest = lastRouteRequest.current;
    if (previousRequest) {
      const distanceMeters = getDistanceMeters(origin, previousRequest.origin);
      if (now - previousRequest.time < 15000 && distanceMeters < 30) {
        return;
      }
    }

    lastRouteRequest.current = { origin, time: now };
    setRouteStatusState('loading');
    setRouteMessage('Calcul du tracé routier…');
    onRouteStatus?.('Calcul du tracé routier…');

    fetchRoadRoute(routeWaypoints)
      .then((route) => {
        if (!active) return;
        setRouteCoordinates(route.coordinates);
        setRouteDistanceMeters(route.distanceMeters);
        setRouteDurationSeconds(route.durationSeconds);
        setRouteStatusState('ready');
        const message = 'Itinéraire en direct';
        setRouteMessage(message);
        onRouteStatus?.(message);

        if (!followDriver && canRenderNativeMap && route.coordinates.length > 1) {
          mapRef.current?.fitToCoordinates(route.coordinates, {
            edgePadding: { top: 85, right: 50, bottom: 145, left: 50 },
            animated: true,
          });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRouteCoordinates([]);
        setRouteStatusState('error');
        const message =
          error instanceof Error ? error.message : "Impossible de calculer l'itinéraire routier.";
        setRouteMessage(message);
        onRouteStatus?.(message);
      });

    return () => {
      active = false;
    };
  }, [routeKey, onRouteStatus, followDriver]);

  const handleRecenter = useCallback(() => {
    setFollowDriver(false);
    if (!canRenderNativeMap) return;
    if (routeCoordinates.length > 1) {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 80, right: 55, bottom: 130, left: 55 },
        animated: true,
      });
      return;
    }
    mapRef.current?.animateToRegion(initialRegion, 450);
  }, [routeCoordinates, initialRegion]);

  // Métriques formatées (Distance, ETA, Heure d'arrivée)
  const displayDistance = useMemo(() => {
    const dist =
      routeDistanceMeters ??
      (activeDriverLocation ? Math.round(getDistanceMeters(activeDriverLocation, customerLocation)) : null);
    if (dist === null) return null;
    return dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`;
  }, [routeDistanceMeters, activeDriverLocation, customerLocation]);

  const displayEta = useMemo(() => {
    if (routeDurationSeconds !== null) {
      const mins = Math.max(1, Math.ceil(routeDurationSeconds / 60));
      return `~${mins} min`;
    }
    if (activeDriverLocation) {
      const dist = getDistanceMeters(activeDriverLocation, customerLocation);
      const mins = Math.max(1, Math.ceil(dist / 450));
      return `~${mins} min`;
    }
    return null;
  }, [routeDurationSeconds, activeDriverLocation, customerLocation]);

  const arrivalClock = useMemo(() => {
    if (routeDurationSeconds === null && !activeDriverLocation) return null;
    const secs =
      routeDurationSeconds ??
      Math.max(60, Math.round(getDistanceMeters(activeDriverLocation!, customerLocation) / 7.5));
    const arrival = new Date(Date.now() + secs * 1000);
    return `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`;
  }, [routeDurationSeconds, activeDriverLocation, customerLocation]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });

  const containerHeight = isExpanded ? Math.max(height, 560) : height;
  const activeCoord = liveScooterCoords || activeDriverLocation;

  const pendingStopsCount = pickupStops.filter((s) => s.status !== 'completed').length;
  const statusHeadline = !driver
    ? 'Recherche d’un livreur…'
    : pendingStopsCount > 0
      ? `Collecte en cours (${pendingStopsCount})`
      : 'En route vers vous';

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {canRenderNativeMap ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          mapType="standard"
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          userInterfaceStyle="light"
          showsBuildings
          showsPointsOfInterests
          showsIndoors
          showsCompass={false}
          showsScale={false}
          onPanDrag={() => {
            if (followDriver) setFollowDriver(false);
          }}
        >
          {/* Restaurants & Hub Courses visibles sur la carte */}
          <RestaurantMapMarkers />

          {/* Halo néon externe + tracé routier rouge REDGO */}
          {routeCoordinates.length > 1 && (
            <>
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="rgba(255, 32, 42, 0.28)"
                strokeWidth={10}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={colors.primary}
                strokeWidth={4.5}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )}

          {/* Marqueur Client (Destination) */}
          <Marker
            coordinate={customerLocation}
            title="Votre adresse de livraison"
            description={customerAddress || "Point d'arrivée"}
          >
            <View style={styles.customerHalo}>
              <View style={styles.customerMarker}>
                <Ionicons name="home" size={15} color="#FFFFFF" />
              </View>
            </View>
          </Marker>

          {/* Marqueurs Points de collecte */}
          {pickupStops.map((stop) => {
            const isCompleted = stop.status === 'completed';
            return (
              <Marker
                key={stop.id}
                coordinate={stop.location}
                title={stop.businessName}
                description={stop.type === 'courses' ? 'Collecte Courses' : 'Collecte Restaurant'}
              >
                <View
                  style={[
                    styles.stopMarker,
                    isCompleted
                      ? styles.stopCompletedMarker
                      : stop.type === 'courses'
                        ? styles.coursesMarker
                        : styles.restaurantMarker,
                  ]}
                >
                  <Ionicons
                    name={
                      isCompleted
                        ? 'checkmark'
                        : stop.type === 'courses'
                          ? 'basket'
                          : 'restaurant'
                    }
                    size={13}
                    color="#FFFFFF"
                  />
                </View>
              </Marker>
            );
          })}

          {/* Marqueur Scooter Animé avec radar néon et orientation */}
          {activeCoord && (
            <Marker
              coordinate={activeCoord}
              title={driver?.name ?? 'Livreur REDGO'}
              description={driver?.vehicleModel ?? 'Position GPS en direct'}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={driverHeading}
              flat
            >
              <View style={styles.driverMarkerWrap}>
                <Animated.View
                  style={[
                    styles.driverPulseRing,
                    { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                  ]}
                />
                <View style={styles.driverMarker}>
                  <Ionicons name="navigate" size={18} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        /* Mode Fallback Android sans clé API Google Maps : Radar Live Tracking 2.0 */
        <View style={styles.fallbackMapBg}>
          <View style={styles.fallbackRadarWrap}>
            <Animated.View
              style={[
                styles.fallbackPulseRing,
                { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
              ]}
            />
            <View style={styles.driverMarker}>
              <Ionicons name="bicycle" size={22} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.fallbackTitle}>{statusHeadline}</Text>
          <Text style={styles.fallbackSub}>
            {customerAddress || "Point d'arrivée REDGO"}
          </Text>
        </View>
      )}

      {/* Header Flottant (Statut GPS + Distance/ETA) */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <View style={styles.gpsStatusPill}>
          {routeStatusState === 'loading' ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.75 }] }} />
          ) : (
            <View
              style={[
                styles.gpsDot,
                activeCoord
                  ? styles.gpsDotLive
                  : routeStatusState === 'error'
                    ? styles.gpsDotError
                    : styles.gpsDotWait,
              ]}
            />
          )}
          <Text style={styles.gpsStatusText} numberOfLines={1}>
            {activeCoord
              ? 'GPS LIVE'
              : routeStatusState === 'error'
                ? 'GPS INDISPONIBLE'
                : 'EN ATTENTE GPS'}
          </Text>
        </View>

        {displayDistance && displayEta ? (
          <View style={styles.etaPill}>
            <Ionicons name="navigate" size={12} color={colors.primary} />
            <Text style={styles.etaPillText}>
              {displayDistance} · {displayEta}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Contrôles de carte flottants à droite */}
      <View style={styles.controlsColumn}>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.pressed]}
          onPress={handleRecenter}
          accessibilityLabel="Recentrer la carte"
        >
          <Ionicons name="locate" size={18} color="#FFFFFF" />
        </Pressable>

        {activeCoord ? (
          <Pressable
            style={({ pressed }) => [
              styles.controlBtn,
              followDriver && styles.controlBtnActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setFollowDriver((prev) => !prev)}
            accessibilityLabel="Suivre le livreur"
          >
            <Ionicons
              name="compass"
              size={18}
              color={followDriver ? colors.primary : '#FFFFFF'}
            />
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.pressed]}
          onPress={() => setIsExpanded((prev) => !prev)}
          accessibilityLabel={isExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
        >
          <Ionicons name={isExpanded ? 'contract' : 'expand'} size={17} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Bottom Sheet Animé : Informations Chauffeur, Progression & ETA */}
      <View style={styles.bottomSheet}>
        <Pressable onPress={toggleSheet} style={styles.sheetHandleArea} hitSlop={8}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopRow}>
            <View style={styles.sheetDriverAvatar}>
              <Text style={styles.sheetDriverInitial}>
                {driver ? driver.name.charAt(0).toUpperCase() : 'R'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {driver ? `${driver.name.split(' ')[0]} · ${statusHeadline}` : statusHeadline}
              </Text>
              <Text style={styles.sheetSub} numberOfLines={1}>
                {driver
                  ? `${driver.vehicleModel}${driver.plateNumber ? ` · ${driver.plateNumber}` : ''}${arrivalClock ? ` · Arrivée ~${arrivalClock}` : ''}`
                  : routeMessage}
              </Text>
            </View>
            {driver?.rating ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={styles.ratingText}>{driver.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <Ionicons
              name={sheetCollapsed ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        <Animated.View
          style={{
            opacity: sheetAnim,
            maxHeight: sheetAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 48],
            }),
            overflow: 'hidden',
          }}
        >
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.sheetFooterMeta}>
            <Text style={styles.sheetMetaText}>
              {routeStatusState === 'error' ? routeMessage : 'Suivi GPS en temps réel'}
            </Text>
            {displayDistance ? (
              <Text style={styles.sheetMetaHighlight}>
                {displayDistance} {displayEta ? `(${displayEta})` : ''}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    marginVertical: 10,
  },
  pressed: {
    opacity: 0.78,
  },
  fallbackMapBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111116',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 70,
    gap: 8,
  },
  fallbackRadarWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  fallbackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  fallbackSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: '75%',
    textAlign: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gpsStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(9, 9, 9, 0.88)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gpsDotLive: {
    backgroundColor: colors.success,
  },
  gpsDotWait: {
    backgroundColor: colors.warning,
  },
  gpsDotError: {
    backgroundColor: colors.error,
  },
  gpsStatusText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(9, 9, 9, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 32, 42, 0.45)',
  },
  etaPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  controlsColumn: {
    position: 'absolute',
    right: 12,
    top: 56,
    gap: 8,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  controlBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 32, 42, 0.16)',
  },
  customerHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  stopMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  coursesMarker: {
    backgroundColor: colors.warning,
  },
  restaurantMarker: {
    backgroundColor: '#EC4899',
  },
  stopCompletedMarker: {
    backgroundColor: colors.success,
  },
  driverMarkerWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseRing: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHandleArea: {
    gap: 6,
  },
  sheetHandle: {
    width: 34,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetDriverAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDriverInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.elevated,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.elevated,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sheetFooterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sheetMetaText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  sheetMetaHighlight: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
});

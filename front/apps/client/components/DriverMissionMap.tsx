import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { resolveBusinessCoordinates } from '../services/businessCoordinates';
import { openGoogleMapsTurnByTurn } from '../services/driverMissions';
import { fetchRoadRoute } from '../services/routing';

const MSAKEN_CENTER = { latitude: 35.7273, longitude: 10.5815 };

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
  onNavigateGoogleMaps,
}: DriverMissionMapProps) {
  const mapRef = useRef<any>(null);
  const [driverLocation, setDriverLocation] = useState<Point>(MSAKEN_CENTER);
  const [routeCoordinates, setRouteCoordinates] = useState<Point[]>([]);
  const [fullRouteCoords, setFullRouteCoords] = useState<Point[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // État du guidage pas à pas en direct sur la carte de l'application
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgressIndex, setNavProgressIndex] = useState(0);
  const [simulatedSpeed, setSimulatedSpeed] = useState(34);

  // Coordonnées du restaurant (point de départ / retrait)
  const startPoint: Point = useMemo(() => {
    if (pickupCoords) return pickupCoords;
    return resolveBusinessCoordinates(businessId, restaurantName || pickupAddress);
  }, [pickupCoords, businessId, restaurantName, pickupAddress]);

  // Coordonnées de la destination client réelle
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

  // Récupérer la position GPS réelle du chauffeur et écouter les mouvements
  useEffect(() => {
    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted) {
            setDriverLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }

          subscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 4000 },
            (newLoc) => {
              if (isMounted && !isNavigating) {
                setDriverLocation({
                  latitude: newLoc.coords.latitude,
                  longitude: newLoc.coords.longitude,
                });
              }
            }
          );
        }
      } catch {
        // Position M'Saken par défaut
      }
    })();

    return () => {
      isMounted = false;
      if (subscription) subscription.remove();
    };
  }, [isNavigating]);

  // Cible active de navigation (restaurant si pickup, client si livraison)
  const activeDestination = activeStep === 'pickup' ? startPoint : endPoint;

  // Calcul du tracé routier OSRM : Chauffeur -> Restaurant -> Client réel
  useEffect(() => {
    let active = true;
    setIsLoadingRoute(true);

    const activeWaypoints = [driverLocation, activeDestination];
    const fullWaypoints = activeStep === 'pickup'
      ? [driverLocation, startPoint, endPoint]
      : [driverLocation, endPoint];

    Promise.all([
      fetchRoadRoute(activeWaypoints).catch(() => ({
        coordinates: activeWaypoints,
        distanceMeters: 1800,
        durationSeconds: 240,
      })),
      fetchRoadRoute(fullWaypoints).catch(() => ({
        coordinates: fullWaypoints,
        distanceMeters: 3200,
        durationSeconds: 480,
      })),
    ])
      .then(([activeRoute, fullRoute]) => {
        if (!active) return;
        setRouteCoordinates(activeRoute.coordinates);
        setFullRouteCoords(fullRoute.coordinates);
        setRouteDistanceMeters(activeRoute.distanceMeters);
        setRouteDurationSeconds(activeRoute.durationSeconds);
        setNavProgressIndex(0);
      })
      .finally(() => {
        if (active) setIsLoadingRoute(false);
      });

    return () => { active = false; };
  }, [
    driverLocation.latitude,
    driverLocation.longitude,
    startPoint.latitude,
    startPoint.longitude,
    endPoint.latitude,
    endPoint.longitude,
    activeStep,
  ]);

  // Animation de guidage en direct sur la carte REDGO : le scooter avance et la caméra le suit
  useEffect(() => {
    if (!isNavigating || routeCoordinates.length === 0) return;

    const interval = setInterval(() => {
      setNavProgressIndex((curr) => {
        const next = curr + 1;
        if (next < routeCoordinates.length) {
          const nextCoord = routeCoordinates[next];
          setDriverLocation(nextCoord);
          setSimulatedSpeed(32 + Math.floor(Math.random() * 8));

          // Auto-centrage immédiat de la caméra sur le scooter en mouvement
          if (mapRef.current && Platform.OS !== 'web') {
            try {
              mapRef.current.animateToRegion({
                latitude: nextCoord.latitude,
                longitude: nextCoord.longitude,
                latitudeDelta: 0.007,
                longitudeDelta: 0.007,
              }, 500);
            } catch {}
          }
          return next;
        }
        return curr;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [isNavigating, routeCoordinates]);

  // Centrage de la carte
  const centerMapOnRoute = () => {
    if (mapRef.current && routeCoordinates.length > 0 && Platform.OS !== 'web') {
      try {
        if (isNavigating) {
          mapRef.current.animateToRegion({
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }, 400);
        } else {
          mapRef.current.fitToCoordinates(
            [driverLocation, startPoint, endPoint, ...routeCoordinates],
            {
              edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
              animated: true,
            },
          );
        }
      } catch {}
    }
  };

  const startInAppNavigation = () => {
    setIsNavigating(true);
    setIsExpanded(true);
    if (mapRef.current && Platform.OS !== 'web') {
      try {
        mapRef.current.animateToRegion({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 500);
      } catch {}
    }
  };

  const stopInAppNavigation = () => {
    setIsNavigating(false);
    centerMapOnRoute();
  };

  const mapHeight = isNavigating ? 400 : isExpanded ? 360 : height;

  // Calcul restant en guidage
  const remainingFraction = routeCoordinates.length > 1
    ? Math.max(0, 1 - (navProgressIndex / (routeCoordinates.length - 1)))
    : 1;

  const totalDistanceMeters = routeDistanceMeters ?? 2400;
  const currentDistanceMeters = isNavigating ? Math.round(totalDistanceMeters * remainingFraction) : totalDistanceMeters;
  const distanceKm = (currentDistanceMeters / 1000).toFixed(1);

  const totalDurationSeconds = routeDurationSeconds ?? 360;
  const currentDurationSeconds = isNavigating ? Math.round(totalDurationSeconds * remainingFraction) : totalDurationSeconds;
  const durationMin = Math.max(1, Math.round(currentDurationSeconds / 60));

  const pickupStreet = (restaurantName || pickupAddress || "Commerce partenaire").split(',')[0].trim();
  const destStreet = (destinationAddress || "Client").split(',')[0].trim();

  // Instruction de guidage en direct
  const currentInstruction = useMemo(() => {
    if (!isNavigating) return '';
    if (navProgressIndex >= routeCoordinates.length - 1) {
      return activeStep === 'pickup' ? `Arrivée à ${pickupStreet} !` : 'Arrivée chez le client !';
    }
    if (activeStep === 'pickup') {
      return `Vers ${pickupStreet} · Suivre l’axe principal`;
    }
    return `Vers ${destStreet} · Tout droit sur l’itinéraire`;
  }, [isNavigating, navProgressIndex, routeCoordinates.length, activeStep, pickupStreet, destStreet]);

  // Rendu Web alternatif
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height: mapHeight }]}>
        <View style={styles.webMapBg}>
          <View style={styles.webGridOverlay} />
          <View style={styles.webRouteLine} />

          {/* Marqueur Restaurant */}
          <View style={[styles.webMarker, styles.webMarkerPickup]}>
            <Ionicons name="storefront" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>{pickupStreet}</Text>
          </View>

          {/* Marqueur Scooter Chauffeur */}
          <View style={[styles.webMarker, styles.webMarkerDriver]}>
            <Ionicons name="bicycle" size={16} color="#fff" />
          </View>

          {/* Marqueur Arrivée Client */}
          <View style={[styles.webMarker, styles.webMarkerDest]}>
            <Ionicons name="flag" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>{destStreet}</Text>
          </View>
        </View>

        {/* HUD Supérieur : Guidage Actif OU Métriques */}
        {isNavigating ? (
          <View style={styles.turnByTurnBanner}>
            <View style={styles.tbtIconCircle}>
              <Ionicons name="navigate" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tbtTitle}>{currentInstruction}</Text>
              <Text style={styles.tbtSub}>
                🚀 {simulatedSpeed} km/h · 📏 {distanceKm} km restant · ⏱️ ~{durationMin} min
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

        {/* Bouton d'action direct : Lancer le guidage sur la carte REDGO */}
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
                {activeStep === 'pickup' ? `Guidage vers ${pickupStreet}` : `Guidage vers ${destStreet}`}
              </Text>
              <Text style={styles.googleMapsActionSub}>Démarrer le guidage GPS sur la carte REDGO</Text>
            </View>
            <Ionicons name="play" size={16} color="#fff" />
          </Pressable>
        ) : null}

        {/* Contrôles carte */}
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

  // Rendu React Native Mobile (iOS / Android) avec MapView
  const MapViewComponent = require('react-native-maps').default;
  const { Marker, Polyline, UrlTile, Circle } = require('react-native-maps');

  const region = isNavigating
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.009,
        longitudeDelta: 0.009,
      }
    : {
        latitude: (startPoint.latitude + endPoint.latitude) / 2,
        longitude: (startPoint.longitude + endPoint.longitude) / 2,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      };

  return (
    <View style={[styles.container, { height: mapHeight }]}>
      <MapViewComponent
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          tileSize={256}
          zIndex={-1}
        />

        {/* Périmètres indicatifs */}
        <Circle
          center={startPoint}
          radius={80}
          fillColor="rgba(16, 185, 129, 0.12)"
          strokeColor="rgba(16, 185, 129, 0.45)"
        />
        <Circle
          center={endPoint}
          radius={80}
          fillColor="rgba(255, 32, 42, 0.12)"
          strokeColor="rgba(255, 32, 42, 0.45)"
        />

        {/* Marqueur Restaurant (Départ / Retrait) */}
        <Marker
          coordinate={startPoint}
          title={`Commerce : ${pickupStreet}`}
          description={restaurantName ? 'Restaurant partenaire REDGO' : 'Point de retrait'}
        >
          <View style={styles.markerPickupPin}>
            <Ionicons name="storefront" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Marqueur Arrivée (Client) */}
        <Marker
          coordinate={endPoint}
          title={`Client : ${destStreet}`}
          description="Adresse de livraison"
        >
          <View style={styles.markerDestPin}>
            <Ionicons name="flag" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Marqueur Scooter Chauffeur en direct */}
        <Marker
          coordinate={driverLocation}
          title="Ma position (Scooter REDGO)"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.markerDriverPin}>
            <Ionicons name="bicycle" size={18} color="#fff" />
          </View>
        </Marker>

        {/* Tracé complet de la mission : Chauffeur -> Restaurant -> Client réel */}
        {fullRouteCoords.length > 0 && activeStep === 'pickup' ? (
          <Polyline
            coordinates={fullRouteCoords}
            strokeColor="rgba(255, 32, 42, 0.35)"
            strokeWidth={3.5}
            lineDashPattern={[6, 4]}
          />
        ) : null}

        {/* Tracé actif du guidage le plus court vers la destination courante */}
        {routeCoordinates.length > 0 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={isNavigating ? 6 : 4.5}
          />
        ) : null}
      </MapViewComponent>

      {/* BANNIÈRE DE GUIDAGE GPS EN DIRECT (Mode Navigation sur la carte REDGO) */}
      {isNavigating ? (
        <View style={styles.turnByTurnBanner}>
          <View style={styles.tbtIconCircle}>
            <Ionicons name="navigate" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tbtTitle} numberOfLines={1}>{currentInstruction}</Text>
            <Text style={styles.tbtSub}>
              🚀 {simulatedSpeed} km/h · 📏 {distanceKm} km · ⏱️ ~{durationMin} min
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

      {/* BOUTON D'ACTION PRINCIPAL : GUIDAGE EN DIRECT SUR LA CARTE DE L'APP */}
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
              {activeStep === 'pickup' ? `Guidage vers ${pickupStreet}` : `Guidage vers ${destStreet}`}
            </Text>
            <Text style={styles.googleMapsActionSub}>Suivre l’itinéraire en direct sur la carte REDGO</Text>
          </View>
          <Ionicons name="play" size={17} color="#fff" />
        </Pressable>
      ) : null}

      {/* Contrôles de carte (Recentrer & Quitter) */}
      <View style={styles.controlsOverlay}>
        <Pressable
          accessibilityRole="button"
          onPress={centerMapOnRoute}
          style={styles.controlBtn}
        >
          <Ionicons name="locate" size={17} color="#fff" />
        </Pressable>

        {showExpandButton && !isNavigating ? (
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

        {/* Bouton secondaire Google Maps externe en option discrète */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvrir dans Google Maps externe"
          onPress={() => {
            const targetAddress = activeStep === 'pickup' ? (pickupAddress || pickupStreet) : (destinationAddress || destStreet);
            const targetPoint = activeStep === 'pickup' ? startPoint : endPoint;
            void openGoogleMapsTurnByTurn(targetAddress, targetPoint.latitude, targetPoint.longitude);
          }}
          style={styles.externalMapBtn}
        >
          <Ionicons name="open-outline" size={15} color="#9CA3AF" />
        </Pressable>
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
  },
  tbtIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbtTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  tbtSub: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tbtCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Barre d'action guidage
  googleMapsActionBar: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 120,
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
  externalMapBtn: {
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
    width: 34,
    height: 34,
    borderRadius: 17,
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

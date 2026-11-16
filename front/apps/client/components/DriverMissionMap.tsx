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
import { fetchRoadRoute } from '../services/routing';
import { openNavigationApp } from '../services/driverMissions';

// Coordonnées de base pour M'Saken et Messaadine
const MSAKEN_CENTER = { latitude: 35.7273, longitude: 10.5815 };
const MESSAADINE_CENTER = { latitude: 35.7551, longitude: 10.5921 };

type Point = { latitude: number; longitude: number };

type DriverMissionMapProps = {
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  pickupCoords?: Point | null;
  destinationCoords?: Point | null;
  height?: number;
  showExpandButton?: boolean;
};

export function DriverMissionMap({
  pickupAddress,
  destinationAddress,
  pickupCoords,
  destinationCoords,
  height = 200,
  showExpandButton = true,
}: DriverMissionMapProps) {
  const [driverLocation, setDriverLocation] = useState<Point>(MSAKEN_CENTER);
  const [routeCoordinates, setRouteCoordinates] = useState<Point[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Déduire les coordonnées à partir de l'adresse ou des props
  const startPoint: Point = useMemo(() => {
    if (pickupCoords) return pickupCoords;
    if (pickupAddress?.toLowerCase().includes('messaadine')) return MESSAADINE_CENTER;
    return MSAKEN_CENTER;
  }, [pickupCoords, pickupAddress]);

  const endPoint: Point = useMemo(() => {
    if (destinationCoords) return destinationCoords;
    if (destinationAddress?.toLowerCase().includes('messaadine')) return MESSAADINE_CENTER;
    // Décalage léger pour avoir 2 points distincts si même ville
    return {
      latitude: MSAKEN_CENTER.latitude + 0.012,
      longitude: MSAKEN_CENTER.longitude + 0.009,
    };
  }, [destinationCoords, destinationAddress]);

  // Récupérer la position GPS réelle du chauffeur
  useEffect(() => {
    let isMounted = true;
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
        }
      } catch {
        // Garde la position M'Saken par défaut
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Calcul du tracé routier OSRM
  useEffect(() => {
    let active = true;
    const waypoints = [startPoint, endPoint];
    setIsLoadingRoute(true);

    fetchRoadRoute(waypoints)
      .then((route) => {
        if (!active) return;
        setRouteCoordinates(route.coordinates);
      })
      .catch(() => {
        if (!active) return;
        // Tracé direct en fallback
        setRouteCoordinates([startPoint, endPoint]);
      })
      .finally(() => {
        if (active) setIsLoadingRoute(false);
      });

    return () => { active = false; };
  }, [startPoint, endPoint]);

  const mapHeight = isExpanded ? 340 : height;

  // Rendu Web alternatif (pour éviter tout crash react-native-maps sur navigateur)
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height: mapHeight }]}>
        <View style={styles.webMapBg}>
          <View style={styles.webGridOverlay} />
          <View style={styles.webRouteLine} />

          {/* Marqueur départ */}
          <View style={[styles.webMarker, styles.webMarkerPickup]}>
            <Ionicons name="radio-button-on" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>Départ</Text>
          </View>

          {/* Marqueur chauffeur */}
          <View style={[styles.webMarker, styles.webMarkerDriver]}>
            <Ionicons name="bicycle" size={16} color="#fff" />
          </View>

          {/* Marqueur arrivée */}
          <View style={[styles.webMarker, styles.webMarkerDest]}>
            <Ionicons name="flag" size={14} color="#fff" />
            <Text style={styles.webMarkerLabel}>Client</Text>
          </View>
        </View>

        {/* Barre de contrôle */}
        <View style={styles.controlsOverlay}>
          <Pressable
            onPress={() => openNavigationApp(destinationAddress || pickupAddress || "M'Saken")}
            style={styles.navButton}
          >
            <Ionicons name="navigate" size={15} color="#fff" />
            <Text style={styles.navButtonText}>Ouvrir GPS</Text>
          </Pressable>

          {showExpandButton ? (
            <Pressable
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.expandButton}
            >
              <Ionicons
                name={isExpanded ? 'contract' : 'expand'}
                size={16}
                color="#fff"
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>Zone M’Saken & Messaadine · Carte active</Text>
        </View>
      </View>
    );
  }

  // Rendu React Native Mobile (iOS / Android) avec MapView
  const MapViewComponent = require('react-native-maps').default;
  const { Marker, Polyline, UrlTile, Circle } = require('react-native-maps');

  const region = {
    latitude: (startPoint.latitude + endPoint.latitude) / 2,
    longitude: (startPoint.longitude + endPoint.longitude) / 2,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };

  return (
    <View style={[styles.container, { height: mapHeight }]}>
      <MapViewComponent
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
        {/* Cercles de couverture */}
        <Circle
          center={MSAKEN_CENTER}
          radius={2600}
          fillColor="rgba(255, 32, 42, 0.07)"
          strokeColor="rgba(255, 32, 42, 0.35)"
        />
        <Circle
          center={MESSAADINE_CENTER}
          radius={2200}
          fillColor="rgba(255, 32, 42, 0.07)"
          strokeColor="rgba(255, 32, 42, 0.35)"
        />

        {/* Marqueur Départ */}
        <Marker coordinate={startPoint} title="Point de retrait">
          <View style={styles.markerPickupPin}>
            <Ionicons name="radio-button-on" size={12} color="#fff" />
          </View>
        </Marker>

        {/* Marqueur Arrivée */}
        <Marker coordinate={endPoint} title="Destination client">
          <View style={styles.markerDestPin}>
            <Ionicons name="flag" size={13} color="#fff" />
          </View>
        </Marker>

        {/* Marqueur Scooter Chauffeur */}
        <Marker coordinate={driverLocation} title="Ma position (Scooter)">
          <View style={styles.markerDriverPin}>
            <Ionicons name="bicycle" size={16} color="#fff" />
          </View>
        </Marker>

        {/* Tracé de la route */}
        {routeCoordinates.length > 0 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : null}
      </MapViewComponent>

      {/* Overlay de contrôle GPS et agrandissement */}
      <View style={styles.controlsOverlay}>
        <Pressable
          onPress={() => openNavigationApp(destinationAddress || pickupAddress || "M'Saken")}
          style={styles.navButton}
        >
          <Ionicons name="navigate" size={15} color="#fff" />
          <Text style={styles.navButtonText}>Ouvrir GPS</Text>
        </Pressable>

        {showExpandButton ? (
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
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

      <View style={styles.infoBadge}>
        <View style={styles.pulseDot} />
        <Text style={styles.infoBadgeText}>Itinéraire en direct · M’Saken</Text>
      </View>
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
    top: 10,
    left: 10,
    backgroundColor: 'rgba(18,18,23,0.85)',
    borderRadius: 8,
    padding: 6,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  expandButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(24, 24, 30, 0.9)',
    borderWidth: 1,
    borderColor: '#3F3F4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 15, 20, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292936',
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  infoBadgeText: { color: '#D4D4D8', fontSize: 10, fontWeight: '700' },

  // Pins natifs
  markerPickupPin: {
    backgroundColor: '#10B981',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerDestPin: {
    backgroundColor: colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerDriverPin: {
    backgroundColor: '#1E40AF',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#60A5FA',
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
    height: 3,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-18deg' }],
  },
  webMarker: {
    position: 'absolute',
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
  },
  webMarkerPickup: {
    backgroundColor: '#10B981',
    top: '30%',
    left: '20%',
  },
  webMarkerDriver: {
    backgroundColor: '#1D4ED8',
    top: '45%',
    left: '48%',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
  },
  webMarkerDest: {
    backgroundColor: colors.primary,
    bottom: '25%',
    right: '20%',
  },
  webMarkerLabel: { color: '#fff', fontSize: 9, fontWeight: '900', marginTop: 2 },
});

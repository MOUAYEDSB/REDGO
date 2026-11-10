import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { colors } from '../constants/theme';
import { Coordinates, DeliveryStop, DriverInfo } from '../types/delivery';
import { fetchRoadRoute } from '../services/routing';

type LiveTrackingMapProps = {
  customerLocation: Coordinates;
  customerAddress?: string;
  driver: DriverInfo | null;
  driverLocation?: Coordinates | null;
  pickupStops?: DeliveryStop[];
  height?: number;
  onRouteStatus?: (message: string) => void;
};

export function LiveTrackingMap({
  customerLocation,
  customerAddress,
  driver,
  driverLocation,
  pickupStops = [],
  height = 280,
  onRouteStatus,
}: LiveTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const lastRouteRequest = useRef<{ origin: Coordinates; time: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [routeMessage, setRouteMessage] = useState('En attente de la position GPS réelle du livreur.');
  const activeDriverLocation = driver?.currentLocation ?? driverLocation ?? null;

  const initialRegion: Region = {
    latitude: activeDriverLocation?.latitude ?? customerLocation.latitude,
    longitude: activeDriverLocation?.longitude ?? customerLocation.longitude,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };

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

  useEffect(() => {
    let active = true;
    if (routeWaypoints.length < 2) {
      setRouteCoordinates([]);
      setRouteMessage('En attente de la position GPS réelle du livreur.');
      onRouteStatus?.('En attente de la position GPS réelle du livreur.');
      return () => { active = false; };
    }

    const now = Date.now();
    const origin = routeWaypoints[0];
    const previousRequest = lastRouteRequest.current;
    if (previousRequest) {
      const latitudeDelta = ((origin.latitude - previousRequest.origin.latitude) * Math.PI) / 180;
      const longitudeDelta = ((origin.longitude - previousRequest.origin.longitude) * Math.PI) / 180;
      const distanceMeters = Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2) * 6371000;
      if (now - previousRequest.time < 15000 && distanceMeters < 30) return;
    }

    lastRouteRequest.current = { origin, time: now };
    setRouteMessage('Calcul du tracé routier…');
    onRouteStatus?.('Calcul du tracé routier…');
    fetchRoadRoute(routeWaypoints)
      .then((route) => {
        if (!active) return;
        setRouteCoordinates(route.coordinates);
        const message = 'Itinéraire routier approximatif · OSRM';
        setRouteMessage(message);
        onRouteStatus?.(message);
        mapRef.current?.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 75, right: 50, bottom: 110, left: 50 },
          animated: true,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRouteCoordinates([]);
        const message = error instanceof Error ? error.message : "Impossible de calculer l'itinéraire routier.";
        setRouteMessage(message);
        onRouteStatus?.(message);
      });

    return () => { active = false; };
  }, [routeKey, onRouteStatus]);

  const handleRecenter = () => {
    if (routeCoordinates.length > 1) {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 75, right: 50, bottom: 110, left: 50 },
        animated: true,
      });
      return;
    }
    mapRef.current?.animateToRegion(initialRegion, 400);
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle="dark"
      >
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Customer Destination Marker */}
        <Marker
          coordinate={customerLocation}
          title="Votre adresse de livraison"
          description={customerAddress || "Point d'arrivée"}
        >
          <View style={styles.customerMarker}>
            <Ionicons name="home" size={16} color="#FFFFFF" />
          </View>
        </Marker>

        {/* Pickup Stops Markers */}
        {pickupStops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={stop.location}
            title={stop.businessName}
            description={stop.type === 'courses' ? 'Collecte Courses' : 'Collecte Restaurant'}
          >
            <View
              style={[
                styles.stopMarker,
                stop.type === 'courses' ? styles.coursesMarker : styles.restaurantMarker,
              ]}
            >
              <Ionicons
                name={stop.type === 'courses' ? 'basket' : 'restaurant'}
                size={14}
                color="#FFFFFF"
              />
            </View>
          </Marker>
        ))}

        {/* Driver Live Marker */}
        {activeDriverLocation && (
          <Marker
            coordinate={activeDriverLocation}
            title={driver?.name ?? 'Livreur REDGO'}
            description={driver?.vehicleModel ?? 'Position GPS en direct'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.scooterEmoji}>🛵</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Recenter Action Button */}
      <Pressable
        style={({ pressed }) => [styles.recenterButton, pressed && { opacity: 0.75 }]}
        onPress={handleRecenter}
        accessibilityLabel="Recentrer la carte"
      >
        <Ionicons name="locate" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Zone Pill */}
      <View style={styles.zonePill}>
        <Ionicons name={routeCoordinates.length ? 'navigate' : 'time-outline'} size={14} color={routeCoordinates.length ? colors.success : colors.warning} />
        <Text style={styles.zoneText}>{routeCoordinates.length ? 'Tracé routier · OSRM' : routeMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: '#2A2A38',
    position: 'relative',
    marginVertical: 10,
  },
  customerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  stopMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  coursesMarker: {
    backgroundColor: '#F59E0B',
  },
  restaurantMarker: {
    backgroundColor: '#EC4899',
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  scooterEmoji: {
    fontSize: 20,
  },
  recenterButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 24, 32, 0.92)',
    borderWidth: 1,
    borderColor: '#3D3D4E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  zonePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18, 18, 24, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#323242',
  },
  zoneText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 250,
  },
});

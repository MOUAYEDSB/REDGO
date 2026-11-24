import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Map,
  Camera,
  Marker,
  GeoJSONSource,
  Layer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { colors } from '../constants/theme';
import { Coordinates, DeliveryStop, DriverInfo } from '../types/delivery';
import { fetchRoadRoute } from '../services/routing';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type LiveTrackingMapProps = {
  customerLocation: Coordinates;
  customerAddress?: string;
  driver: DriverInfo | null;
  driverLocation?: Coordinates | null;
  pickupStops?: DeliveryStop[];
  height?: number;
  onRouteStatus?: (message: string) => void;
};

function getRouteCamera(coordinates: Coordinates[]) {
  const longitudes = coordinates.map((point) => point.longitude);
  const latitudes = coordinates.map((point) => point.latitude);

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

export function LiveTrackingMap({
  customerLocation,
  customerAddress,
  driver,
  driverLocation,
  pickupStops = [],
  height = 280,
  onRouteStatus,
}: LiveTrackingMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const lastRouteRequest = useRef<{ origin: Coordinates; time: number } | null>(null);

  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [routeMessage, setRouteMessage] = useState(
    'En attente de la position GPS reelle du livreur.'
  );

  const activeDriverLocation = driver?.currentLocation ?? driverLocation ?? null;

  const [liveScooterCoords, setLiveScooterCoords] =
    useState<Coordinates | null>(activeDriverLocation);

  // Synchronisation avec la position GPS externe.
  useEffect(() => {
    if (activeDriverLocation) {
      setLiveScooterCoords(activeDriverLocation);
    }
  }, [activeDriverLocation?.latitude, activeDriverLocation?.longitude]);

  // Progression du scooter le long du trajet (uniquement en mode démo / si pas de position GPS réelle).
  useEffect(() => {
    if (routeCoordinates.length < 2 || !driver || activeDriverLocation) return;

    const interval = setInterval(() => {
      setLiveScooterCoords((current) => {
        const currentIndex = current
          ? routeCoordinates.findIndex(
              (point) =>
                Math.abs(point.latitude - current.latitude) < 0.0001 &&
                Math.abs(point.longitude - current.longitude) < 0.0001
            )
          : 0;

        const nextIndex =
          currentIndex >= 0 && currentIndex < routeCoordinates.length - 1
            ? currentIndex + 1
            : 0;

        return routeCoordinates[nextIndex];
      });
    }, 2600);

    return () => clearInterval(interval);
  }, [routeCoordinates, driver]);

  const initialCenter: [number, number] = [
    activeDriverLocation?.longitude ?? customerLocation.longitude,
    activeDriverLocation?.latitude ?? customerLocation.latitude,
  ];

  const routeWaypoints = useMemo(() => {
    if (!activeDriverLocation) return [];

    return [
      activeDriverLocation,
      ...pickupStops
        .filter((stop) => stop.status !== 'completed')
        .map((stop) => stop.location),
      customerLocation,
    ];
  }, [activeDriverLocation, customerLocation, pickupStops]);

  const routeKey = routeWaypoints
    .map(
      ({ latitude, longitude }) =>
        latitude.toFixed(5) + ',' + longitude.toFixed(5)
    )
    .join(';');

  // Conversion du trajet OSRM en GeoJSON pour MapLibre.
  const routeGeoJSON = useMemo(
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
                    (point): [number, number] => [
                      point.longitude,
                      point.latitude,
                    ]
                  ),
                },
              },
            ]
          : [],
    }),
    [routeCoordinates]
  );

  // Calcul du trajet routier avec OSRM.
  useEffect(() => {
    let active = true;

    if (routeWaypoints.length < 2) {
      setRouteCoordinates([]);

      const message = 'En attente de la position GPS reelle du livreur.';
      setRouteMessage(message);
      onRouteStatus?.(message);

      return () => {
        active = false;
      };
    }

    const now = Date.now();
    const origin = routeWaypoints[0];
    const previousRequest = lastRouteRequest.current;

    if (previousRequest) {
      const latitudeDelta =
        ((origin.latitude - previousRequest.origin.latitude) * Math.PI) / 180;

      const longitudeDelta =
        ((origin.longitude - previousRequest.origin.longitude) * Math.PI) / 180;

      const distanceMeters =
        Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2) * 6371000;

      if (now - previousRequest.time < 15000 && distanceMeters < 30) {
        return;
      }
    }

    lastRouteRequest.current = { origin, time: now };

    setRouteMessage('Calcul du trace routier...');
    onRouteStatus?.('Calcul du trace routier...');

    fetchRoadRoute(routeWaypoints)
      .then((route) => {
        if (!active) return;

        setRouteCoordinates(route.coordinates);

        const message = 'Itineraire routier approximatif - OSRM';
        setRouteMessage(message);
        onRouteStatus?.(message);

        if (route.coordinates.length > 1) {
          cameraRef.current?.easeTo({
            ...getRouteCamera(route.coordinates),
            duration: 700,
          });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;

        setRouteCoordinates([]);

        const message =
          error instanceof Error
            ? error.message
            : "Impossible de calculer l'itineraire routier.";

        setRouteMessage(message);
        onRouteStatus?.(message);
      });

    return () => {
      active = false;
    };
  }, [routeKey, onRouteStatus]);

  // Recentrage de la carte.
  const handleRecenter = () => {
    if (routeCoordinates.length > 1) {
      cameraRef.current?.easeTo({
        ...getRouteCamera(routeCoordinates),
        duration: 600,
      });
      return;
    }

    const position =
      liveScooterCoords || activeDriverLocation || customerLocation;

    cameraRef.current?.easeTo({
      center: [position.longitude, position.latitude],
      zoom: 14,
      duration: 400,
    });
  };

  return (
    <View style={[styles.container, { height }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: 13,
          }}
        />

        {routeCoordinates.length > 1 && (
          <GeoJSONSource id="live-route" data={routeGeoJSON}>
            <Layer
              id="live-route-line"
              source="live-route"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': colors.primary,
                'line-width': 4,
              }}
            />
          </GeoJSONSource>
        )}

        {/* Destination du client */}
        <Marker
          lngLat={[
            customerLocation.longitude,
            customerLocation.latitude,
          ]}
        >
          <View
            style={styles.customerMarker}
            accessibilityLabel={customerAddress || "Point d'arrivee"}
          >
            <Ionicons name="home" size={16} color="#FFFFFF" />
          </View>
        </Marker>

        {/* Points de collecte */}
        {pickupStops.map((stop) => (
          <Marker
            key={stop.id}
            lngLat={[
              stop.location.longitude,
              stop.location.latitude,
            ]}
          >
            <View
              style={[
                styles.stopMarker,
                stop.type === 'courses'
                  ? styles.coursesMarker
                  : styles.restaurantMarker,
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

        {/* Position du livreur */}
        {(liveScooterCoords || activeDriverLocation) && (
          <Marker
            lngLat={[
              (liveScooterCoords || activeDriverLocation!).longitude,
              (liveScooterCoords || activeDriverLocation!).latitude,
            ]}
          >
            <View
              style={styles.driverMarker}
              accessibilityLabel={
                driver?.vehicleModel || 'Position GPS du livreur'
              }
            >
              <Ionicons name="bicycle" size={23} color="#FFFFFF" />
            </View>
          </Marker>
        )}
      </Map>

      {/* Bouton de recentrage */}
      <Pressable
        style={({ pressed }) => [
          styles.recenterButton,
          pressed && { opacity: 0.75 },
        ]}
        onPress={handleRecenter}
        accessibilityLabel="Recentrer la carte"
      >
        <Ionicons name="locate" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Informations de suivi */}
      <View style={styles.zonePill}>
        <Ionicons
          name={
            driver
              ? 'bicycle'
              : routeCoordinates.length
                ? 'navigate'
                : 'time-outline'
          }
          size={14}
          color={
            driver
              ? '#10B981'
              : routeCoordinates.length
                ? colors.success
                : colors.warning
          }
        />

        <Text style={styles.zoneText}>
          {driver
            ? driver.name.split(' ')[0] + ' en deplacement direct - M Saken'
            : routeCoordinates.length
              ? 'Trace routier - OSRM'
              : routeMessage}
        </Text>
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

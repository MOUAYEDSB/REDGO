import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, Region, UrlTile } from 'react-native-maps';
import { Button } from '../../components/ui';
import { colors } from '../../constants/theme';

const MSaken = { latitude: 35.7273, longitude: 10.5815 };
const Messaadine = { latitude: 35.7551, longitude: 10.5921 };
const DEFAULT_REGION: Region = {
  latitude: 35.7412,
  longitude: 10.5868,
  latitudeDelta: 0.065,
  longitudeDelta: 0.065,
};

type Point = { latitude: number; longitude: number };

const distanceInKm = (from: Point, to: Point) => {
  const earthRadiusKm = 6371;
  const latitudeDifference = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDifference = ((to.longitude - from.longitude) * Math.PI) / 180;
  const latitudeFrom = (from.latitude * Math.PI) / 180;
  const latitudeTo = (to.latitude * Math.PI) / 180;
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(latitudeFrom) * Math.cos(latitudeTo) * Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isInCoverage = (point: Point) =>
  distanceInKm(point, MSaken) <= 2.6 || distanceInKm(point, Messaadine) <= 2.2;

const pointFromParams = (latitude?: string, longitude?: string): Point | null => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  return Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)
    ? { latitude: parsedLatitude, longitude: parsedLongitude }
    : null;
};

const destinationFromAddress = (value?: string): Point => {
  if (value?.includes('Messaadine')) return Messaadine;
  if (value?.includes('M\'Saken') || value?.includes("M'saken")) return MSaken;
  return Messaadine;
};

export default function BookingMap() {
  const mapRef = useRef<MapView>(null);
  const {
    mode = 'pickup',
    flow = 'ride',
    address,
    pickup,
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    recipientLat,
    recipientLng,
    useCurrentLocation,
  } = useLocalSearchParams<{
    mode?: string;
    flow?: string;
    address?: string;
    pickup?: string;
    pickupLat?: string;
    pickupLng?: string;
    destinationLat?: string;
    destinationLng?: string;
    recipientLat?: string;
    recipientLng?: string;
    useCurrentLocation?: string;
  }>();
  const [pickupPoint, setPickupPoint] = useState<Point>(
    () => pointFromParams(pickupLat, pickupLng) || MSaken,
  );
  const [hasSelectedPickup, setHasSelectedPickup] = useState(
    () => pointFromParams(pickupLat, pickupLng) !== null,
  );
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<Point>(
    () => pointFromParams(destinationLat, destinationLng) || destinationFromAddress(address),
  );
  const [hasSelectedDestination, setHasSelectedDestination] = useState(
    () => pointFromParams(destinationLat, destinationLng) !== null,
  );
  const [hasSelectedDelivery, setHasSelectedDelivery] = useState(
    () => pointFromParams(recipientLat, recipientLng) !== null,
  );
  const [isCurrentPositionSelected, setIsCurrentPositionSelected] = useState(false);
  const [route, setRoute] = useState<Point[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [activeSelection, setActiveSelection] = useState<'pickup' | 'destination'>('pickup');
  const selectedDestinationAddress = `Destination choisie (${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)})`;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationMessage('Position indisponible. Vous pouvez sélectionner un point sur la carte.');
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setCurrentPoint(point);
        const savedDeliveryPoint = pointFromParams(recipientLat, recipientLng);
        if (mode === 'delivery' && !savedDeliveryPoint) {
          setDestinationPoint(point);
          setHasSelectedDelivery(true);
          setIsCurrentPositionSelected(true);
        }
        const savedPickupPoint = pointFromParams(pickupLat, pickupLng);
        if ((mode === 'pickup' || mode === 'itinerary') && !savedPickupPoint) {
          setPickupPoint(point);
          if (mode === 'itinerary') setHasSelectedPickup(true);
        }
        if (mode === 'itinerary') {
          setActiveSelection('destination');
          const mapCenter = savedPickupPoint || point;
          mapRef.current?.animateToRegion({ ...mapCenter, latitudeDelta: 0.045, longitudeDelta: 0.045 });
        } else if (mode === 'delivery') {
          const mapCenter = savedDeliveryPoint || point;
          mapRef.current?.animateToRegion({ ...mapCenter, latitudeDelta: 0.045, longitudeDelta: 0.045 });
        } else {
          mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.045, longitudeDelta: 0.045 });
        }
      } catch {
        setLocationMessage(
          mode === 'delivery' && useCurrentLocation === '1'
            ? 'Position GPS indisponible. Touchez la carte pour choisir un autre point.'
            : 'GPS indisponible. Vous pouvez sélectionner un point sur la carte.',
        );
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, [mode, pickupLat, pickupLng, recipientLat, recipientLng, useCurrentLocation]);

  useEffect(() => {
    if (mode !== 'destination' && mode !== 'itinerary') return;
    setLoadingRoute(true);
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupPoint.longitude},${pickupPoint.latitude};${destinationPoint.longitude},${destinationPoint.latitude}?overview=full&geometries=geojson`;
    fetch(url)
      .then((response) => response.json())
      .then((data: { code?: string; routes?: { geometry?: { coordinates: [number, number][] } }[] }) => {
        const coordinates = data.routes?.[0]?.geometry?.coordinates;
        setRoute(coordinates?.map(([longitude, latitude]) => ({ latitude, longitude })) ?? []);
        if (!coordinates?.length) setLocationMessage("Aucun itinéraire routier disponible pour ces adresses.");
      })
      .catch(() => setLocationMessage("Impossible de charger l'itinéraire. Les points restent visibles sur la carte."))
      .finally(() => setLoadingRoute(false));
  }, [mode, pickupPoint, destinationPoint]);

  const confirm = () => {
    if (mode === 'delivery') {
      if (!hasSelectedDelivery) {
        Alert.alert('Adresse requise', 'Sélectionnez votre position ou touchez la carte pour choisir un point de livraison.');
        return;
      }
      if (!isInCoverage(destinationPoint)) {
        Alert.alert(
          'Zone non disponible',
          "REDGO livre actuellement à M'Saken et Messaadine. Choisissez un point dans cette zone.",
        );
        return;
      }
      const deliveryAddress = `${isCurrentPositionSelected ? 'Ma position actuelle' : 'Point de livraison'} (${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)})`;
      router.navigate({
        pathname: '/checkout',
        params: {
          deliveryAddress,
          recipientLat: destinationPoint.latitude.toString(),
          recipientLng: destinationPoint.longitude.toString(),
        },
      });
      return;
    }

    if (mode === 'itinerary') {
      if (!hasSelectedPickup || !hasSelectedDestination) {
        Alert.alert(
          'Trajet incomplet',
          'Choisissez le départ et l’arrivée en touchant les deux points sur la carte.',
        );
        return;
      }
      if (!isInCoverage(pickupPoint) || !isInCoverage(destinationPoint)) {
        Alert.alert(
          'Zone non disponible',
          "Le départ et l'arrivée doivent être dans la zone REDGO de M'Saken ou Messaadine.",
        );
        return;
      }

      const itineraryParams = {
        pickup: `Position choisie (${pickupPoint.latitude.toFixed(5)}, ${pickupPoint.longitude.toFixed(5)})`,
        pickupLat: pickupPoint.latitude.toString(),
        pickupLng: pickupPoint.longitude.toString(),
        destination: `Destination choisie (${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)})`,
        destinationLat: destinationPoint.latitude.toString(),
        destinationLng: destinationPoint.longitude.toString(),
      };

      if (flow === 'booking') {
        router.push({ pathname: '/booking/service', params: itineraryParams });
      } else {
        router.push({
          pathname: '/ride/summary',
          params: {
            pickupAddress: itineraryParams.pickup,
            pickupLat: itineraryParams.pickupLat,
            pickupLng: itineraryParams.pickupLng,
            destinationAddress: itineraryParams.destination,
            destinationLat: itineraryParams.destinationLat,
            destinationLng: itineraryParams.destinationLng,
          },
        });
      }
      return;
    }

    const selectedPoint = mode === 'pickup' ? pickupPoint : destinationPoint;
    if (!isInCoverage(selectedPoint)) {
      Alert.alert(
        'Zone non disponible',
        `REDGO couvre actuellement M'Saken et Messaadine. Déplacez votre ${mode === 'pickup' ? 'départ' : 'destination'} dans une zone disponible.`,
      );
      return;
    }
    const pickupCoordinates = {
      pickupLat: selectedPoint.latitude.toString(),
      pickupLng: selectedPoint.longitude.toString(),
    };
    const pickupAddress = `Position choisie (${selectedPoint.latitude.toFixed(5)}, ${selectedPoint.longitude.toFixed(5)})`;
    const destinationCoordinates = {
      destinationLat: selectedPoint.latitude.toString(),
      destinationLng: selectedPoint.longitude.toString(),
    };
    const destinationAddress = `Destination choisie (${selectedPoint.latitude.toFixed(5)}, ${selectedPoint.longitude.toFixed(5)})`;

    if (mode === 'destination') {
      if (flow === 'booking') {
        router.push({
          pathname: '/booking/service',
          params: {
            pickup: pickup || 'M\'Saken Centre',
            pickupLat,
            pickupLng,
            destination: destinationAddress,
            ...destinationCoordinates,
          },
        });
      } else {
        router.push({
          pathname: '/ride/summary',
          params: {
            pickupAddress: pickup || pickupAddress,
            pickupLat,
            pickupLng,
            destinationAddress,
            ...destinationCoordinates,
          },
        });
      }
      return;
    }

    if (flow === 'booking') {
      router.push({
        pathname: '/booking/destination',
        params: {
          pickup: pickupAddress,
          ...pickupCoordinates,
        },
      });
    } else {
      router.push({
        pathname: '/ride/destination',
        params: {
          pickupAddress,
          ...pickupCoordinates,
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        onPress={(event) => {
          const point = event.nativeEvent.coordinate;
          if (mode === 'pickup' || (mode === 'itinerary' && activeSelection === 'pickup')) {
            setPickupPoint(point);
            if (mode === 'itinerary') {
              setHasSelectedPickup(true);
              setActiveSelection('destination');
            }
          } else {
            setDestinationPoint(point);
            if (mode === 'delivery') {
              setHasSelectedDelivery(true);
              setIsCurrentPositionSelected(false);
            }
            if (mode === 'itinerary') setHasSelectedDestination(true);
          }
        }}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          tileSize={256}
          zIndex={-1}
        />
        <Circle center={MSaken} radius={2600} fillColor="rgba(255,38,56,.08)" strokeColor="rgba(255,38,56,.45)" />
        <Circle center={Messaadine} radius={2200} fillColor="rgba(255,38,56,.08)" strokeColor="rgba(255,38,56,.45)" />
        {mode === 'delivery' ? (
          <Marker coordinate={destinationPoint} title="Adresse de livraison" pinColor={colors.primary} />
        ) : mode === 'pickup' ? (
          <Marker coordinate={pickupPoint} title="Départ" pinColor={colors.success} />
        ) : (
          <>
            <Marker coordinate={pickupPoint} title="Départ" pinColor={colors.success} />
            <Marker coordinate={destinationPoint} title="Destination" pinColor={colors.primary} />
          </>
        )}
        {currentPoint && mode !== 'delivery' ? <Marker coordinate={currentPoint} title="Ma position" pinColor="#FFFFFF" /> : null}
        {route.length > 0 ? <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={5} /> : null}
      </MapView>

      {loadingLocation || loadingRoute ? <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View> : null}
      <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.label}>
          {mode === 'delivery'
            ? 'ADRESSE DE LIVRAISON'
            : mode === 'itinerary'
            ? 'CHOISIR LES POINTS DU TRAJET'
            : mode === 'destination' ? 'DESTINATION SÉLECTIONNÉE' : 'POINT DE DÉPART'}
        </Text>
        {mode === 'itinerary' ? (
          <>
            <Text style={styles.selectionHint}>
              {activeSelection === 'pickup'
                ? 'Touchez la carte pour choisir le départ.'
                : 'Départ choisi. Touchez la carte pour choisir l’arrivée.'}
            </Text>
            <View style={styles.selectionRow}>
              <Pressable
                style={[styles.selectionButton, activeSelection === 'pickup' && styles.selectionButtonActive]}
                onPress={() => setActiveSelection('pickup')}
              >
                <Ionicons name="radio-button-on" size={16} color={colors.success} />
                <Text style={styles.selectionText} numberOfLines={1}>Départ</Text>
              </Pressable>
              <Pressable
                style={[styles.selectionButton, activeSelection === 'destination' && styles.selectionButtonDestinationActive]}
                onPress={() => setActiveSelection('destination')}
              >
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.selectionText} numberOfLines={1}>Arrivée</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <Text style={styles.address}>
          {mode === 'delivery'
            ? hasSelectedDelivery
              ? `${isCurrentPositionSelected ? 'Ma position actuelle' : 'Point choisi sur la carte'}\n${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)}`
              : 'Touchez la carte pour choisir votre adresse de livraison.'
            : mode === 'itinerary'
            ? `Départ : ${pickupPoint.latitude.toFixed(5)}, ${pickupPoint.longitude.toFixed(5)}\nArrivée : ${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)}`
            : mode === 'pickup'
            ? `Position sélectionnée\n${pickupPoint.latitude.toFixed(5)}, ${pickupPoint.longitude.toFixed(5)}`
            : selectedDestinationAddress}
        </Text>
        {locationMessage ? <Text style={styles.notice}>{locationMessage}</Text> : null}
        {(mode === 'pickup' || mode === 'itinerary' || mode === 'delivery') && currentPoint ? (
          <Pressable
            style={styles.currentLocation}
            onPress={() => {
              if (mode === 'delivery') {
                setDestinationPoint(currentPoint);
                setHasSelectedDelivery(true);
                setIsCurrentPositionSelected(true);
              } else {
                setPickupPoint(currentPoint);
              }
              if (mode === 'itinerary') {
                setHasSelectedPickup(true);
                setActiveSelection('destination');
              }
              mapRef.current?.animateToRegion({ ...currentPoint, latitudeDelta: 0.045, longitudeDelta: 0.045 });
            }}
          >
            <Ionicons name="locate" size={18} color={colors.success} />
            <Text style={styles.currentLocationText}>
              {mode === 'delivery' ? 'Livrer à ma position actuelle' : 'Utiliser ma position actuelle'}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
        <Button
          title={mode === 'delivery'
            ? 'Confirmer l’adresse de livraison'
            : mode === 'itinerary'
            ? 'Confirmer le trajet'
            : mode === 'destination' ? 'Confirmer la destination' : 'Confirmer le départ'}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, map: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  loader: { position: 'absolute', top: 70, alignSelf: 'center', width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', top: 52, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: colors.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border }, handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' }, address: { color: colors.text, fontSize: 18, fontWeight: '800', marginVertical: 12 }, notice: { color: colors.warning, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  currentLocation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 42, borderRadius: 12, backgroundColor: colors.elevated, marginBottom: 10 },
  currentLocationText: { color: colors.success, fontSize: 13, fontWeight: '800' },
  attribution: { color: colors.textSecondary, fontSize: 9, textAlign: 'right', marginBottom: 8 },
  selectionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  selectionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40, borderRadius: 12, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  selectionButtonActive: { borderColor: colors.success, backgroundColor: 'rgba(34, 197, 94, 0.12)' },
  selectionButtonDestinationActive: { borderColor: colors.primary, backgroundColor: 'rgba(255, 38, 56, 0.12)' },
  selectionText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  selectionHint: { color: colors.textSecondary, fontSize: 11, marginTop: 8 },
});

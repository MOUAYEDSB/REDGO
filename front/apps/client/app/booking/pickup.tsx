import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Screen } from '../../components/Screen';
import { LocalLandmarkMarkers } from '../../components/LocalLandmarkMarkers';
import { RestaurantMapMarkers } from '../../components/RestaurantMapMarkers';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import { MESSAADINE_CENTER, MSAKEN_CENTER } from '../../services/delivery';
import { formatHumanReadableAddress, reverseGeocodeAddress } from '../../services/geocoding';
import { createScooterRide } from '../../services/ride';
import { fetchRoadRoute } from '../../services/routing';

type ScooterMode = 'ride' | 'parcel';
type TripDirection = 'one_way' | 'round_trip';
type ParcelPayer = 'sender' | 'recipient';
type Point = { latitude: number; longitude: number };

const canRenderNativeMap =
  Platform.OS === 'ios' || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

const DEFAULT_REGION: Region = {
  latitude: 35.7412,
  longitude: 10.5868,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const QUICK_PLACES: { id: string; label: string; coords: Point }[] = [
  { id: 'msaken', label: "M'Saken Centre", coords: MSAKEN_CENTER },
  { id: 'messaadine', label: 'Messaadine Centre', coords: { latitude: 35.7613215, longitude: 10.5966672 } },
  { id: 'marche', label: 'Marché Municipal', coords: { latitude: 35.7266265, longitude: 10.5829902 } },
  { id: 'gare', label: "Gare de M'Saken", coords: { latitude: 35.7289523, longitude: 10.5999530 } },
  { id: 'csb_nord', label: "CSB Nord M'Saken", coords: { latitude: 35.7337083, longitude: 10.5742259 } },
];

export default function BookingPickupScreen() {
  const { tripMode: initialMode } = useLocalSearchParams<{ tripMode?: string }>();

  const [tripMode, setTripMode] = useState<ScooterMode>(
    initialMode === 'parcel' ? 'parcel' : 'ride'
  );

  const [pickupAddress, setPickupAddress] = useState("M'Saken Centre");
  const [destinationAddress, setDestinationAddress] = useState('Messaadine Centre');
  const [pickupPoint, setPickupPoint] = useState<Point>(MSAKEN_CENTER);
  const [destinationPoint, setDestinationPoint] = useState<Point>(MESSAADINE_CENTER);

  const [tripDirection, setTripDirection] = useState<TripDirection>('one_way');
  const [rideNote, setRideNote] = useState('');

  const [parcelPayer, setParcelPayer] = useState<ParcelPayer>('sender');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [parcelNote, setParcelNote] = useState('');

  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(3.8);
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const mapRef = useRef<MapView>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [activeMapTarget, setActiveMapTarget] = useState<'pickup' | 'destination'>('pickup');
  const [isLocating, setIsLocating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setIsCalculatingRoute(true);

    fetchRoadRoute([pickupPoint, destinationPoint])
      .then((route) => {
        if (!active) return;
        setRouteCoords(route.coordinates);
        setDistanceKm(Math.max(0.5, Number((route.distanceMeters / 1000).toFixed(1))));
        setDurationMinutes(Math.max(3, Math.ceil(route.durationSeconds / 60)));
      })
      .catch(() => {
        if (!active) return;
        setRouteCoords([pickupPoint, destinationPoint]);
      })
      .finally(() => {
        if (active) setIsCalculatingRoute(false);
      });

    return () => {
      active = false;
    };
  }, [pickupPoint.latitude, pickupPoint.longitude, destinationPoint.latitude, destinationPoint.longitude]);

  const activeFareMillimes = useMemo(() => {
    if (tripMode === 'parcel') return 2500;
    return tripDirection === 'round_trip' ? 3500 : 2500;
  }, [tripMode, tripDirection]);

  const openMapModal = (target: 'pickup' | 'destination') => {
    setActiveMapTarget(target);
    setMapModalVisible(true);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Localisation', 'Autorisez le GPS pour utiliser votre position actuelle.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const label = formatHumanReadableAddress(null, pt.latitude, pt.longitude);

      if (activeMapTarget === 'pickup') {
        setPickupPoint(pt);
        setPickupAddress(label);
        void reverseGeocodeAddress(pt.latitude, pt.longitude).then((exact) => setPickupAddress(exact));
      } else {
        setDestinationPoint(pt);
        setDestinationAddress(label);
        void reverseGeocodeAddress(pt.latitude, pt.longitude).then((exact) => setDestinationAddress(exact));
      }
      mapRef.current?.animateToRegion({
        ...pt,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      });
    } catch {
      Alert.alert('GPS indisponible', 'Sélectionnez directement un point sur la carte.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchDriver = async () => {
    if (isSubmitting) return;
    const cleanPickup = pickupAddress.trim().slice(0, 290);
    const cleanDestination = destinationAddress.trim();

    if (!cleanPickup || !cleanDestination) {
      Alert.alert('Adresse manquante', 'Veuillez indiquer un point de départ et une destination.');
      return;
    }

    if (tripMode === 'parcel') {
      if (!recipientName.trim() || !recipientPhone.trim()) {
        Alert.alert(
          'Informations destinataire',
          'Veuillez saisir le nom et le numéro de la personne qui va récupérer le colis.'
        );
        return;
      }
    }

    const rawDestination =
      tripMode === 'parcel'
        ? `[COLIS · Payé par ${parcelPayer === 'sender' ? 'Expéditeur' : 'Destinataire'}] ${cleanDestination} · Dest: ${recipientName.trim()} (${recipientPhone.trim()})${parcelNote.trim() ? ` · Note: ${parcelNote.trim()}` : ''}`
        : `${tripDirection === 'round_trip' ? '[ALLER-RETOUR] ' : '[ALLER SIMPLE] '}${cleanDestination}${rideNote.trim() ? ` · Note: ${rideNote.trim()}` : ''}`;

    const effectiveDestination = rawDestination.slice(0, 295);

    setIsSubmitting(true);
    try {
      const ride = await createScooterRide({
        pickupAddress: cleanPickup,
        pickupLocation: pickupPoint,
        destinationAddress: effectiveDestination,
        destinationLocation: destinationPoint,
        fareMillimes: activeFareMillimes,
        durationMinutes,
      });

      router.replace({
        pathname: '/booking/searching',
        params: {
          id: ride.id,
          reference: ride.reference,
          pickup: cleanPickup,
          destination: effectiveDestination,
          fare: String(activeFareMillimes),
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.message || 'Impossible de lancer la recherche de chauffeur. Veuillez réessayer.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scooter Taxi REDGO</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Sélecteur 2 parties : Se déplacer / Envoyer un colis */}
      <View style={styles.modeSwitcher}>
        <Pressable
          onPress={() => setTripMode('ride')}
          style={[styles.modeBtn, tripMode === 'ride' && styles.modeBtnActive]}
        >
          <Ionicons
            name="bicycle"
            size={18}
            color={tripMode === 'ride' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.modeBtnText, tripMode === 'ride' && styles.modeBtnTextActive]}>
            Se déplacer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTripMode('parcel')}
          style={[styles.modeBtn, tripMode === 'parcel' && styles.modeBtnActive]}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={tripMode === 'parcel' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.modeBtnText, tripMode === 'parcel' && styles.modeBtnTextActive]}>
            Envoyer un colis
          </Text>
        </Pressable>
      </View>

      {/* Carte Trajet simplifiée + Ouverture Carte de bas en haut */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionLabel}>
            {tripMode === 'parcel' ? 'TRAJET DU COLIS' : 'VOTRE TRAJET'}
          </Text>
          <Pressable onPress={() => openMapModal('pickup')} style={styles.openMapPill}>
            <Ionicons name="map-outline" size={14} color={colors.primary} />
            <Text style={styles.openMapPillText}>Choisir sur la carte</Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.dotGreen} />
          <TextInput
            value={pickupAddress}
            onChangeText={setPickupAddress}
            placeholder="Point de départ (ou choisir sur carte)"
            placeholderTextColor={colors.textSecondary}
            style={styles.routeInput}
          />
          <Pressable onPress={() => openMapModal('pickup')} style={styles.pinBtn}>
            <Ionicons name="locate" size={16} color={colors.success} />
          </Pressable>
        </View>

        <View style={styles.connectorLine} />

        <View style={styles.inputRow}>
          <View style={styles.dotRed} />
          <TextInput
            value={destinationAddress}
            onChangeText={setDestinationAddress}
            placeholder={tripMode === 'parcel' ? 'Adresse de livraison du colis' : 'Destination'}
            placeholderTextColor={colors.textSecondary}
            style={styles.routeInput}
          />
          <Pressable onPress={() => openMapModal('destination')} style={styles.pinBtn}>
            <Ionicons name="location" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {QUICK_PLACES.map((place) => (
            <Pressable
              key={place.id}
              onPress={() => {
                setDestinationAddress(place.label);
                setDestinationPoint(place.coords);
              }}
              style={styles.presetChip}
            >
              <Text style={styles.presetChipText}>{place.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.metricsStrip}>
          <View style={styles.metricBadge}>
            <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metricText}>{distanceKm} km</Text>
          </View>
          <View style={styles.metricBadge}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metricText}>
              {isCalculatingRoute ? 'Calcul…' : `~${durationMinutes} min`}
            </Text>
          </View>
          <View style={styles.metricBadgeHighlight}>
            <Text style={styles.metricHighlightText}>{formatMillimes(activeFareMillimes)}</Text>
          </View>
        </View>
      </View>

      {/* Fiche spécifique : SE DÉPLACER */}
      {tripMode === 'ride' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>OPTIONS DU TRAJET</Text>
          <View style={styles.twoColRow}>
            <Pressable
              onPress={() => setTripDirection('one_way')}
              style={[
                styles.choiceBtn,
                tripDirection === 'one_way' && styles.choiceBtnActive,
              ]}
            >
              <Ionicons
                name="arrow-forward-circle-outline"
                size={18}
                color={tripDirection === 'one_way' ? '#FFFFFF' : colors.textSecondary}
              />
              <View>
                <Text
                  style={[
                    styles.choiceTitle,
                    tripDirection === 'one_way' && styles.choiceTitleActive,
                  ]}
                >
                  Aller simple
                </Text>
                <Text
                  style={[
                    styles.choiceSub,
                    tripDirection === 'one_way' && styles.choiceSubActive,
                  ]}
                >
                  2.500 DT
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setTripDirection('round_trip')}
              style={[
                styles.choiceBtn,
                tripDirection === 'round_trip' && styles.choiceBtnActive,
              ]}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={tripDirection === 'round_trip' ? '#FFFFFF' : colors.textSecondary}
              />
              <View>
                <Text
                  style={[
                    styles.choiceTitle,
                    tripDirection === 'round_trip' && styles.choiceTitleActive,
                  ]}
                >
                  Aller-retour
                </Text>
                <Text
                  style={[
                    styles.choiceSub,
                    tripDirection === 'round_trip' && styles.choiceSubActive,
                  ]}
                >
                  +1.000 DT (3.500 DT)
                </Text>
              </View>
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>NOTE (OPTIONNEL)</Text>
          <TextInput
            value={rideNote}
            onChangeText={setRideNote}
            placeholder="Ajouter une précision pour le chauffeur..."
            placeholderTextColor={colors.textSecondary}
            style={styles.fieldInput}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>QUI VA PAYER LA LIVRAISON ?</Text>
          <View style={styles.twoColRow}>
            <Pressable
              onPress={() => setParcelPayer('sender')}
              style={[
                styles.choiceBtn,
                parcelPayer === 'sender' && styles.choiceBtnActive,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={17}
                color={parcelPayer === 'sender' ? '#FFFFFF' : colors.textSecondary}
              />
              <View>
                <Text
                  style={[
                    styles.choiceTitle,
                    parcelPayer === 'sender' && styles.choiceTitleActive,
                  ]}
                >
                  Expéditeur
                </Text>
                <Text
                  style={[
                    styles.choiceSub,
                    parcelPayer === 'sender' && styles.choiceSubActive,
                  ]}
                >
                  Au départ
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setParcelPayer('recipient')}
              style={[
                styles.choiceBtn,
                parcelPayer === 'recipient' && styles.choiceBtnActive,
              ]}
            >
              <Ionicons
                name="hand-left-outline"
                size={17}
                color={parcelPayer === 'recipient' ? '#FFFFFF' : colors.textSecondary}
              />
              <View>
                <Text
                  style={[
                    styles.choiceTitle,
                    parcelPayer === 'recipient' && styles.choiceTitleActive,
                  ]}
                >
                  Destinataire
                </Text>
                <Text
                  style={[
                    styles.choiceSub,
                    parcelPayer === 'recipient' && styles.choiceSubActive,
                  ]}
                >
                  À la livraison
                </Text>
              </View>
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>NOM & PRÉNOM DU DESTINATAIRE</Text>
          <TextInput
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Ex : Ahmed Ben Salah"
            placeholderTextColor={colors.textSecondary}
            style={styles.fieldInput}
          />

          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>NUMÉRO DU DESTINATAIRE</Text>
          <TextInput
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            placeholder="Ex : 22 123 456"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            style={styles.fieldInput}
          />

          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>NOTE SI NÉCESSAIRE (OPTIONNEL)</Text>
          <TextInput
            value={parcelNote}
            onChangeText={setParcelNote}
            placeholder="Contenu du colis, instructions..."
            placeholderTextColor={colors.textSecondary}
            style={styles.fieldInput}
          />
        </View>
      )}

      {/* Bouton principal */}
      <View style={styles.footer}>
        <Pressable
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && { opacity: 0.88 },
            isSubmitting && { opacity: 0.65 },
          ]}
          onPress={() => void handleSearchDriver()}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                Chercher un chauffeur · {formatMillimes(activeFareMillimes)}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* MODAL CARTE : S'ouvre de bas en haut */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setMapModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.modalTitle}>Choisir sur la carte</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.modalTargetRow}>
            <Pressable
              onPress={() => setActiveMapTarget('pickup')}
              style={[
                styles.modalTargetBtn,
                activeMapTarget === 'pickup' && styles.modalTargetPickupActive,
              ]}
            >
              <View style={styles.dotGreen} />
              <Text style={styles.modalTargetText}>Départ</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveMapTarget('destination')}
              style={[
                styles.modalTargetBtn,
                activeMapTarget === 'destination' && styles.modalTargetDestActive,
              ]}
            >
              <View style={styles.dotRed} />
              <Text style={styles.modalTargetText}>Arrivée</Text>
            </Pressable>
          </View>

          <View style={styles.modalMapWrap}>
            {canRenderNativeMap ? (
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                mapType="standard"
                initialRegion={DEFAULT_REGION}
                userInterfaceStyle="light"
                showsBuildings
                showsPointsOfInterests
                showsIndoors
                onPress={(e) => {
                  const pt = e.nativeEvent.coordinate;
                  const label = formatHumanReadableAddress(null, pt.latitude, pt.longitude);
                  if (activeMapTarget === 'pickup') {
                    setPickupPoint(pt);
                    setPickupAddress(label);
                    setActiveMapTarget('destination');
                    void reverseGeocodeAddress(pt.latitude, pt.longitude).then((exact) => setPickupAddress(exact));
                  } else {
                    setDestinationPoint(pt);
                    setDestinationAddress(label);
                    void reverseGeocodeAddress(pt.latitude, pt.longitude).then((exact) => setDestinationAddress(exact));
                  }
                }}
              >
                <Circle
                  center={MSAKEN_CENTER}
                  radius={2600}
                  fillColor="rgba(255,32,42,0.06)"
                  strokeColor="rgba(255,32,42,0.35)"
                />
                <Circle
                  center={MESSAADINE_CENTER}
                  radius={2200}
                  fillColor="rgba(255,32,42,0.06)"
                  strokeColor="rgba(255,32,42,0.35)"
                />
                <LocalLandmarkMarkers
                  onSelectLandmark={(lm) => {
                    const pt = { latitude: lm.latitude, longitude: lm.longitude };
                    if (activeMapTarget === 'pickup') {
                      setPickupPoint(pt);
                      setPickupAddress(lm.address);
                      setActiveMapTarget('destination');
                    } else {
                      setDestinationPoint(pt);
                      setDestinationAddress(lm.address);
                    }
                  }}
                />
                <RestaurantMapMarkers
                  onSelectPlace={(place) => {
                    const pt = { latitude: place.latitude, longitude: place.longitude };
                    if (activeMapTarget === 'pickup') {
                      setPickupPoint(pt);
                      setPickupAddress(place.name);
                      setActiveMapTarget('destination');
                    } else {
                      setDestinationPoint(pt);
                      setDestinationAddress(place.name);
                    }
                  }}
                />
                {routeCoords.length > 1 ? (
                  <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />
                ) : null}
                <Marker coordinate={pickupPoint} title="Départ" pinColor={colors.success} />
                <Marker coordinate={destinationPoint} title="Arrivée" pinColor={colors.primary} />
              </MapView>
            ) : (
              <View style={styles.modalFallbackMap}>
                <Ionicons name="map-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.modalFallbackText}>
                  Touchez un raccourci ou utilisez votre position GPS ci-dessous.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={() => void handleUseCurrentLocation()}
              style={styles.modalGpsBtn}
              disabled={isLocating}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <Ionicons name="locate" size={18} color={colors.success} />
              )}
              <Text style={styles.modalGpsText}>
                Utiliser ma position pour {activeMapTarget === 'pickup' ? 'le départ' : "l'arrivée"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMapModalVisible(false)}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>
                Confirmer le trajet ({distanceKm} km · {formatMillimes(activeFareMillimes)})
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  openMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 32, 42, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  openMapPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  connectorLine: {
    width: 1.5,
    height: 12,
    backgroundColor: colors.border,
    marginLeft: 16,
    marginVertical: 2,
  },
  routeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pinBtn: {
    padding: 4,
  },
  presetsRow: {
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.elevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metricText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  metricBadgeHighlight: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 32, 42, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metricHighlightText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  choiceBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  choiceTitleActive: {
    color: '#FFFFFF',
  },
  choiceSub: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  choiceSubActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  fieldInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
  },
  footer: {
    paddingTop: 4,
    paddingBottom: 30,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: colors.secondary,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modalTargetRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.secondary,
  },
  modalTargetBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalTargetPickupActive: {
    borderColor: colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  modalTargetDestActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 32, 42, 0.14)',
  },
  modalTargetText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  modalMapWrap: {
    flex: 1,
    position: 'relative',
  },
  modalFallbackMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: '#111116',
  },
  modalFallbackText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  modalFooter: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalGpsBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalGpsText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
});

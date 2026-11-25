import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import { MESSAADINE_CENTER, MSAKEN_CENTER } from '../../services/delivery';
import { fetchRoadRoute } from '../../services/routing';

type ScooterMode = 'ride' | 'parcel';
type TripDirection = 'one_way' | 'round_trip';

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function BookingServiceScreen() {
  const {
    pickup = "M'Saken Centre",
    destination = 'Messaadine Centre',
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    tripMode = 'ride',
  } = useLocalSearchParams<{
    pickup?: string;
    destination?: string;
    pickupLat?: string;
    pickupLng?: string;
    destinationLat?: string;
    destinationLng?: string;
    tripMode?: string;
  }>();

  const [selectedMode, setSelectedMode] = useState<ScooterMode>(
    tripMode === 'parcel' ? 'parcel' : 'ride'
  );
  const [tripDirection, setTripDirection] = useState<TripDirection>('one_way');
  const [rideNote, setRideNote] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [parcelNote, setParcelNote] = useState('');

  const [isCalculating, setIsCalculating] = useState(true);
  const [distanceKm, setDistanceKm] = useState<number>(3.5);
  const [durationMinutes, setDurationMinutes] = useState<number>(10);

  const pickupLocation = useMemo(() => {
    const lat = Number(pickupLat);
    const lng = Number(pickupLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    if (pickup.toLowerCase().includes('messaadine')) return MESSAADINE_CENTER;
    return MSAKEN_CENTER;
  }, [pickupLat, pickupLng, pickup]);

  const destinationLocation = useMemo(() => {
    const lat = Number(destinationLat);
    const lng = Number(destinationLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    if (destination.toLowerCase().includes('messaadine')) return MESSAADINE_CENTER;
    if (destination.toLowerCase().includes('sousse') || destination.toLowerCase().includes('iset')) {
      return { latitude: 35.758, longitude: 10.595 };
    }
    return {
      latitude: MSAKEN_CENTER.latitude + 0.012,
      longitude: MSAKEN_CENTER.longitude + 0.008,
    };
  }, [destinationLat, destinationLng, destination]);

  useEffect(() => {
    let active = true;
    setIsCalculating(true);

    fetchRoadRoute([pickupLocation, destinationLocation])
      .then((route) => {
        if (!active) return;
        const km = Math.max(0.5, Number((route.distanceMeters / 1000).toFixed(1)));
        const mins = Math.max(3, Math.ceil(route.durationSeconds / 60));
        setDistanceKm(km);
        setDurationMinutes(mins);
      })
      .catch(() => {
        if (!active) return;
        const km = Math.max(0.8, Number((haversineKm(pickupLocation, destinationLocation) * 1.25).toFixed(1)));
        const mins = Math.max(4, Math.ceil(km * 2.5));
        setDistanceKm(km);
        setDurationMinutes(mins);
      })
      .finally(() => {
        if (active) setIsCalculating(false);
      });

    return () => {
      active = false;
    };
  }, [pickupLocation, destinationLocation]);

  // Tarification dynamique :
  // - Se déplacer : Aller simple = 2.500 DT | Aller-retour = 2.500 + 1.000 = 3.500 DT
  // - Envoyer un colis : 2.500 DT
  const rideFare = tripDirection === 'round_trip' ? 3500 : 2500;
  const parcelFare = 2500;

  const activeFare = selectedMode === 'parcel' ? parcelFare : rideFare;
  const activeServiceName =
    selectedMode === 'parcel'
      ? 'Envoyer un colis (Express)'
      : tripDirection === 'round_trip'
        ? 'Se déplacer · Aller-retour'
        : 'Se déplacer · Aller simple';

  const handleConfirmService = () => {
    router.push({
      pathname: '/booking/summary',
      params: {
        pickup,
        pickupLat: String(pickupLocation.latitude),
        pickupLng: String(pickupLocation.longitude),
        destination,
        destinationLat: String(destinationLocation.latitude),
        destinationLng: String(destinationLocation.longitude),
        tripMode: selectedMode,
        tripDirection,
        rideNote: rideNote.trim(),
        recipientPhone: recipientPhone.trim(),
        parcelNote: parcelNote.trim(),
        serviceId: selectedMode === 'parcel' ? 'scooter_parcel' : 'scooter_ride',
        serviceName: activeServiceName,
        fare: String(activeFare),
        duration: String(durationMinutes),
        distanceKm: String(distanceKm),
      },
    });
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scooter Taxi REDGO</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.title}>Choisissez votre option</Text>
      <Text style={styles.subtitle}>
        2 services simples et rapides à M’Saken & Messaadine.
      </Text>

      {/* Option 1 : Se déplacer */}
      <Pressable
        onPress={() => setSelectedMode('ride')}
        style={[styles.optionCard, selectedMode === 'ride' && styles.optionCardActive]}
      >
        <View style={[styles.iconBox, selectedMode === 'ride' && styles.iconBoxActive]}>
          <Ionicons
            name="bicycle"
            size={24}
            color={selectedMode === 'ride' ? '#FFFFFF' : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Se déplacer</Text>
            {isCalculating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.optionPrice}>{formatMillimes(rideFare)}</Text>
            )}
          </View>
          <Text style={styles.optionDesc}>
            1 passager · Casque fourni · ~{durationMinutes} min ({distanceKm} km)
          </Text>
        </View>
      </Pressable>

      {/* Fiche Se déplacer : Aller simple / Aller-retour + Note */}
      {selectedMode === 'ride' ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>TYPE DE TRAJET</Text>
          <View style={styles.directionRow}>
            <Pressable
              onPress={() => setTripDirection('one_way')}
              style={[
                styles.directionBtn,
                tripDirection === 'one_way' && styles.directionBtnActive,
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
                    styles.directionTitle,
                    tripDirection === 'one_way' && styles.directionTitleActive,
                  ]}
                >
                  Aller simple
                </Text>
                <Text
                  style={[
                    styles.directionPrice,
                    tripDirection === 'one_way' && styles.directionPriceActive,
                  ]}
                >
                  2.500 DT
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setTripDirection('round_trip')}
              style={[
                styles.directionBtn,
                tripDirection === 'round_trip' && styles.directionBtnActive,
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
                    styles.directionTitle,
                    tripDirection === 'round_trip' && styles.directionTitleActive,
                  ]}
                >
                  Aller-retour
                </Text>
                <Text
                  style={[
                    styles.directionPrice,
                    tripDirection === 'round_trip' && styles.directionPriceActive,
                  ]}
                >
                  +1.000 DT (3.500 DT)
                </Text>
              </View>
            </Pressable>
          </View>

          <Text style={[styles.detailsLabel, { marginTop: 14 }]}>NOTE AU CHAUFFEUR (OPTIONNEL)</Text>
          <TextInput
            value={rideNote}
            onChangeText={setRideNote}
            placeholder="Ajouter une précision (repère, attente, etc.)"
            placeholderTextColor={colors.textSecondary}
            style={styles.textInput}
          />
        </View>
      ) : null}

      {/* Option 2 : Envoyer un colis */}
      <Pressable
        onPress={() => setSelectedMode('parcel')}
        style={[styles.optionCard, selectedMode === 'parcel' && styles.optionCardActive]}
      >
        <View style={[styles.iconBox, selectedMode === 'parcel' && styles.iconBoxActive]}>
          <Ionicons
            name="cube-outline"
            size={23}
            color={selectedMode === 'parcel' ? '#FFFFFF' : colors.warning}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Envoyer un colis</Text>
            {isCalculating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.optionPrice}>{formatMillimes(parcelFare)}</Text>
            )}
          </View>
          <Text style={styles.optionDesc}>
            Livraison express de main à main · ~{durationMinutes} min ({distanceKm} km)
          </Text>
        </View>
      </Pressable>

      {/* Fiche Colis : Numéro du destinataire + Note */}
      {selectedMode === 'parcel' ? (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>NUMÉRO DU DESTINATAIRE (OPTIONNEL)</Text>
          <TextInput
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            placeholder="Numéro de celui qui va récupérer le colis"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            style={styles.textInput}
          />

          <Text style={[styles.detailsLabel, { marginTop: 14 }]}>NOTE SI NÉCESSAIRE (OPTIONNEL)</Text>
          <TextInput
            value={parcelNote}
            onChangeText={setParcelNote}
            placeholder="Contenu du colis, étage, instructions..."
            placeholderTextColor={colors.textSecondary}
            style={styles.textInput}
          />
        </View>
      ) : null}

      {/* Récapitulatif dynamique du trajet */}
      <View style={styles.routeCard}>
        <View style={styles.routeStop}>
          <View style={styles.pickupDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>DÉPART</Text>
            <Text style={styles.routeAddress} numberOfLines={1}>{pickup}</Text>
          </View>
        </View>
        <View style={styles.routeDivider} />
        <View style={styles.routeStop}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>ARRIVÉE</Text>
            <Text style={styles.routeAddress} numberOfLines={1}>{destination}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.88 }]}
          onPress={handleConfirmService}
        >
          <Text style={styles.confirmButtonText}>
            Continuer · {formatMillimes(activeFare)}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
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
    marginBottom: 20,
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
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  optionCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 32, 42, 0.08)',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  optionPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  optionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  detailsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionBtn: {
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
  directionBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  directionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  directionTitleActive: {
    color: '#FFFFFF',
  },
  directionPrice: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  directionPriceActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
  },
  routeCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginLeft: 2,
  },
  routeDivider: {
    height: 18,
    width: 1.5,
    backgroundColor: colors.border,
    marginLeft: 7,
    marginVertical: 4,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  footer: {
    paddingVertical: 20,
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
});

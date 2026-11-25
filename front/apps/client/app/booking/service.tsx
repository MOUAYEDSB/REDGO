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

function estimateDynamicFareMillimes(distanceKm: number, mode: ScooterMode): number {
  const base = mode === 'parcel' ? 2500 : 3000;
  const perKm = 550;
  const raw = base + Math.max(0, distanceKm - 1) * perKm;
  return Math.max(base, Math.round(raw / 500) * 500);
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

  const rideFare = useMemo(() => estimateDynamicFareMillimes(distanceKm, 'ride'), [distanceKm]);
  const parcelFare = useMemo(() => estimateDynamicFareMillimes(distanceKm, 'parcel'), [distanceKm]);

  const activeFare = selectedMode === 'parcel' ? parcelFare : rideFare;
  const activeServiceName =
    selectedMode === 'parcel'
      ? 'Envoyer un colis (Express)'
      : 'Se déplacer (Scooter 1 passager)';

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
            1 passager · Casque fourni · Arrivée en ~{durationMinutes} min ({distanceKm} km)
          </Text>
        </View>
      </Pressable>

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

      {/* Détails colis optionnels si mode Colis sélectionné */}
      {selectedMode === 'parcel' ? (
        <View style={styles.parcelBox}>
          <Text style={styles.parcelLabel}>DÉTAILS DU COLIS & DESTINATAIRE (OPTIONNEL)</Text>
          <TextInput
            value={parcelNote}
            onChangeText={setParcelNote}
            placeholder="Ex : Clés / Documents · Tél destinataire 22 000 000"
            placeholderTextColor={colors.textSecondary}
            style={styles.parcelInput}
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
  parcelBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  parcelLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  parcelInput: {
    height: 44,
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

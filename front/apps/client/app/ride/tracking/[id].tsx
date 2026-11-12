import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DriverInfoCard } from '../../../components/DriverInfoCard';
import { CashPaymentPanel } from '../../../components/CashPaymentPanel';
import { LiveTrackingMap } from '../../../components/LiveTrackingMap';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { formatMillimes } from '../../../services/cart';
import { MESSAADINE_CENTER, MSAKEN_CENTER } from '../../../services/delivery';
import { subscribeToDriverLocation, LocationConnectionState } from '../../../services/driverLocation';
import { RideStage, ScooterTaxiOrder } from '../../../types/ride';

export default function RideTrackingScreen() {
  const {
    id = 'ride_101',
    reference = 'TX-4091',
    pickup = 'M\'Saken Centre, Avenue Habib Bourguiba',
    destination = 'Messaadine Centre',
    fare = '4500',
  } = useLocalSearchParams<{
    id?: string;
    reference?: string;
    pickup?: string;
    destination?: string;
    fare?: string;
  }>();

  const fareMillimes = parseInt(fare, 10) || 4500;

  const initialRide: ScooterTaxiOrder = {
    id,
    reference,
    createdAt: new Date().toISOString(),
    status: 'searching',
    pickup: {
      address: pickup,
      location: MSAKEN_CENTER,
    },
    destination: {
      address: destination,
      location: MESSAADINE_CENTER,
    },
    service: {
      id: 'scooter-taxi-single',
      name: 'Scooter Express (1 passager)',
      description: 'Déplacement rapide et économique · Casque fourni',
      helmetProvided: true,
      passengerCapacity: 1,
    },
    metrics: {
      distanceKm: 4.8,
      estimatedDurationMinutes: 12,
      fareMillimes,
    },
    paymentMethod: 'cash',
    driver: null,
  };

  const [ride, setRide] = useState<ScooterTaxiOrder>(initialRide);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingState, setTrackingState] = useState<LocationConnectionState>('connecting');
  const [trackingMessage, setTrackingMessage] = useState('Connexion au suivi GPS…');

  useEffect(() => {
    return subscribeToDriverLocation(
      String(id),
      (location) => {
        setDriverLocation(location);
        setRide((current) => ({ ...current, status: 'driver_assigned' }));
        setTrackingState('live');
        setTrackingMessage('Position GPS reçue en direct.');
      },
      (state, message) => {
        setTrackingState(state);
        if (message) setTrackingMessage(message);
      },
    );
  }, [id]);

  const getStatusDisplay = (status: RideStage) => {
    switch (status) {
      case 'searching':
        return {
          title: 'Recherche de chauffeur',
          subtitle: 'Recherche d’un scooter à proximité',
          color: colors.primary,
        };
      case 'driver_assigned':
        return {
          title: 'Chauffeur confirmé',
          subtitle: driverLocation ? 'Position du chauffeur actualisée en direct.' : 'En attente de la première position GPS.',
          color: colors.success,
        };
      case 'approaching_pickup':
        return {
          title: 'Chauffeur en approche',
          subtitle: 'Arrivée estimée dans ~3 min au point de départ',
          color: colors.primary,
        };
      case 'arrived_at_pickup':
        return {
          title: 'Chauffeur sur place !',
          subtitle: 'Votre chauffeur vous attend au point de départ',
          color: colors.success,
        };
      case 'ride_started':
        return {
          title: 'Course en cours',
          subtitle: 'En route vers votre destination',
          color: '#3B82F6',
        };
      case 'ride_completed':
        return {
          title: 'Course terminée',
          subtitle: 'Vous êtes arrivé à destination. Merci !',
          color: colors.success,
        };
      case 'cancelled':
        return {
          title: 'Course annulée',
          subtitle: 'Cette réservation a été annulée.',
          color: colors.error,
        };
    }
  };

  const statusInfo = getStatusDisplay(ride.status);
  const canCancel = ride.status === 'driver_assigned' || ride.status === 'approaching_pickup';

  const handleCancelRide = () => {
    Alert.alert(
      'Annuler la course ?',
      'Votre chauffeur est déjà en route. Souhaitez-vous confirmer l\'annulation ?',
      [
        { text: 'Non, conserver', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            setRide((prev) => ({ ...prev, status: 'cancelled' }));
            setTimeout(() => router.replace('/(tabs)/home'), 1500);
          },
        },
      ],
    );
  };

  return (
    <Screen scroll style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/(tabs)/home')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Course en direct</Text>
        <View style={[styles.liveIndicator, trackingState !== 'live' && styles.waitingIndicator]}>
          <View style={[styles.liveDot, trackingState !== 'live' && styles.waitingDot]} />
          <Text style={[styles.liveText, trackingState !== 'live' && styles.waitingText]}>{trackingState === 'live' ? 'LIVE' : 'GPS EN ATTENTE'}</Text>
        </View>
      </View>

      {/* Live Map */}
      <LiveTrackingMap
        customerLocation={ride.destination.location}
        customerAddress={ride.destination.address}
        driver={ride.driver}
        driverLocation={driverLocation}
        pickupStops={[
          {
            id: 'pickup_stop',
            businessName: 'Point de prise en charge',
            type: 'courses',
            address: ride.pickup.address,
            location: ride.pickup.location,
            status: ride.status === 'ride_started' || ride.status === 'ride_completed' ? 'completed' : 'pending',
          },
        ]}
        height={260}
      />

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIconWrap, { backgroundColor: `${statusInfo.color}20` }]}>
            <Ionicons name="bicycle" size={22} color={statusInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{statusInfo.title}</Text>
            <Text style={styles.statusSubtitle}>{statusInfo.subtitle}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Référence course</Text>
            <Text style={styles.refText}>{ride.reference}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Tarif en espèces</Text>
            <Text style={styles.priceText}>{formatMillimes(ride.metrics.fareMillimes)}</Text>
          </View>
        </View>
      </View>

      {/* Driver Info Card */}
      {trackingState !== 'live' ? <Text style={styles.trackingMessage}>{trackingMessage}</Text> : null}
      <DriverInfoCard
        driver={ride.driver}
        roleDescription="Livreur REDGO"
        isAssigned={trackingState === 'live'}
      />

      {id !== 'ride_101' ? (
        <CashPaymentPanel targetType="scooter_ride" targetId={String(id)} />
      ) : null}

      {/* Itinerary Details */}
      <View style={styles.itineraryCard}>
        <View style={styles.stopRow}>
          <View style={styles.dotGreen} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stopLabel}>PRISE EN CHARGE</Text>
            <Text style={styles.stopAddress}>{ride.pickup.address}</Text>
          </View>
        </View>

        <View style={styles.connectorLine} />

        <View style={styles.stopRow}>
          <View style={styles.dotRed} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stopLabel}>DESTINATION</Text>
            <Text style={styles.stopAddress}>{ride.destination.address}</Text>
          </View>
        </View>
      </View>

      {/* Cancel button if applicable */}
      {canCancel && (
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.8 }]}
          onPress={handleCancelRide}
        >
          <Text style={styles.cancelButtonText}>Annuler la course</Text>
        </Pressable>
      )}

      {ride.status === 'ride_completed' && (
        <Pressable
          style={styles.doneButton}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.doneButtonText}>Terminer et retourner à l'accueil</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181822',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2F2F3D',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  waitingIndicator: { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' },
  waitingDot: { backgroundColor: colors.warning },
  waitingText: { color: colors.warning },
  trackingMessage: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 6 },
  statusCard: {
    backgroundColor: '#181822',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2F2F3D',
    padding: 16,
    marginVertical: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  statusSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#262634',
    paddingTop: 12,
    marginTop: 14,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  refText: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  priceText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  itineraryCard: {
    backgroundColor: '#181822',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D3D',
    padding: 16,
    marginVertical: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginTop: 3,
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#323244',
    marginLeft: 5,
    marginVertical: 2,
  },
  stopLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stopAddress: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  cancelButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
  doneButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});

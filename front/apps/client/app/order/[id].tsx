import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DeliveryStatusCard } from '../../components/DeliveryStatusCard';
import { DriverInfoCard } from '../../components/DriverInfoCard';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';
import { OrderStatusTimeline } from '../../components/OrderStatusTimeline';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { MSAKEN_CENTER } from '../../services/delivery';
import { LocationConnectionState, subscribeToDriverLocation } from '../../services/driverLocation';
import { DeliveryOrder } from '../../types/delivery';

export default function LiveDeliveryTrackingScreen() {
  const {
    id = 'order_default',
    reference = 'RG-1048',
    hasCourses = '1',
    hasFood = '1',
  } = useLocalSearchParams<{
    id?: string;
    reference?: string;
    hasCourses?: string;
    hasFood?: string;
  }>();

  // Initial order configuration
  const initialOrder: DeliveryOrder = {
    id,
    reference,
    createdAt: new Date().toISOString(),
    status: 'searching_driver',
    hasCourses: hasCourses === '1',
    hasFood: hasFood === '1',
    stops: [
      ...(hasCourses === '1'
        ? [
            {
              id: 'stop_courses',
              businessName: 'Courses REDGO (Hub Central)',
              type: 'courses' as const,
              address: 'Route Messaadine, M\'Saken',
              location: { latitude: 35.7335, longitude: 10.5842 },
              status: 'pending' as const,
            },
          ]
        : []),
      ...(hasFood === '1'
        ? [
            {
              id: 'stop_food',
              businessName: 'Restaurant Karma Kitchen',
              type: 'restaurant' as const,
              address: 'Avenue Habib Bourguiba, M\'Saken',
              location: { latitude: 35.7302, longitude: 10.582 },
              status: 'pending' as const,
            },
          ]
        : []),
    ],
    destination: {
      address: 'Avenue Habib Bourguiba, M\'Saken Centre',
      instructions: 'Face à la banque, 2ème étage',
      recipientPhone: '+216 22 123 456',
      location: MSAKEN_CENTER,
    },
    pricing: {
      productsSubtotalMillimes: 21500,
      deliveryFeeMillimes: 3500,
      serviceFeeMillimes: 500,
      finalTotalMillimes: 25500,
    },
    paymentMethod: 'cash',
    driver: null,
    estimatedArrivalMinutes: 18,
  };

  const [order, setOrder] = useState<DeliveryOrder>(initialOrder);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingState, setTrackingState] = useState<LocationConnectionState>('connecting');

  useEffect(() => {
    return subscribeToDriverLocation(
      String(id),
      (location) => {
        setDriverLocation(location);
        setOrder((current) => ({ ...current, status: 'driver_assigned' }));
        setTrackingState('live');
      },
      (state) => setTrackingState(state),
    );
  }, [id]);

  return (
    <Screen scroll style={styles.screen}>
      {/* Top Bar */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/(tabs)/home')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Suivi en Direct</Text>
        <View style={[styles.liveIndicator, trackingState !== 'live' && styles.waitingIndicator]}>
          <View style={[styles.liveDot, trackingState !== 'live' && styles.waitingDot]} />
          <Text style={[styles.liveText, trackingState !== 'live' && styles.waitingText]}>{trackingState === 'live' ? 'LIVE' : 'EN ATTENTE'}</Text>
        </View>
      </View>

      {/* Live Map */}
      <LiveTrackingMap
        customerLocation={order.destination.location}
        customerAddress={order.destination.address}
        driver={order.driver}
        driverLocation={driverLocation}
        pickupStops={order.stops}
        height={260}
      />

      {/* Status Card */}
      <DeliveryStatusCard order={order} />

      {/* Driver Card */}
      <DriverInfoCard
        driver={order.driver}
        roleDescription="Livreur REDGO"
        isAssigned={trackingState === 'live'}
      />

      {/* Timeline with only relevant stages */}
      <OrderStatusTimeline
        currentStage={order.status}
        hasCourses={order.hasCourses}
        hasFood={order.hasFood}
      />

      {/* Help & Support Button */}
      <Pressable
        style={styles.supportButton}
        onPress={() => router.push('/(tabs)/profile')}
      >
        <Ionicons name="help-buoy-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.supportButtonText}>Besoin d'aide avec cette commande ?</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  header: {
    height: 64,
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
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 38, 56, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  liveText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  waitingIndicator: { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' },
  waitingDot: { backgroundColor: colors.warning },
  waitingText: { color: colors.warning },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  supportButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});

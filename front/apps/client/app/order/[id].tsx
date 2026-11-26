import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { DeliveryStatusCard } from '../../components/DeliveryStatusCard';
import { DriverInfoCard } from '../../components/DriverInfoCard';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';
import { OrderStatusTimeline } from '../../components/OrderStatusTimeline';
import { Screen } from '../../components/Screen';
import { CashPaymentPanel } from '../../components/CashPaymentPanel';
import { colors } from '../../constants/theme';
import { MSAKEN_CENTER } from '../../services/delivery';
import { LocationConnectionState, subscribeToDriverLocation } from '../../services/driverLocation';
import { fetchCustomerOrderById } from '../../services/ordersHistory';
import { DeliveryOrder } from '../../types/delivery';
import { subscribeDriverUpdates } from '../../services/driverMissions';
import { requireSupabase } from '../../services/supabase';

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
            businessName: 'Restaurant partenaire',
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
  const [hasLoadedRealOrder, setHasLoadedRealOrder] = useState(id === 'order_default');
  const [isCancelling, setIsCancelling] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingState, setTrackingState] = useState<LocationConnectionState>('connecting');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/home');
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!id || id === 'order_default') return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const realOrder = await fetchCustomerOrderById(String(id));
        if (realOrder && isMounted) {
          setOrder(realOrder);
          setHasLoadedRealOrder(true);
        }
      } catch (err) {
        console.warn('fetchStatus error :', err);
      }
    };

    void fetchStatus();

    // Écoute immédiate des mises à jour chauffeur (ex: acceptation de mission)
    const unsubscribeDriver = subscribeDriverUpdates(() => {
      if (isMounted) void fetchStatus();
    });

    // Écoute Supabase Realtime (sans polling)
    const client = requireSupabase();
    const channelName = `order-status-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'delivery_orders', filter: `id=eq.${id}` },
        () => {
          if (isMounted) void fetchStatus();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_missions', filter: `delivery_order_id=eq.${id}` },
        () => {
          if (isMounted) void fetchStatus();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      unsubscribeDriver();
      void client.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    return subscribeToDriverLocation(
      String(id),
      (location) => {
        setDriverLocation(location);
        setTrackingState('live');
      },
      (state) => setTrackingState(state),
    );
  }, [id]);

  const canCancel =
    id !== 'order_default' &&
    (order.status === 'confirmed' || order.status === 'searching_driver') &&
    !order.driver;

  const handleCancelOrder = () => {
    Alert.alert(
      'Annuler la commande ?',
      'Souhaitez-vous vraiment annuler cette commande ? Elle sera enregistrée comme annulée dans votre historique.',
      [
        { text: 'Non, conserver', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const client = requireSupabase();
              const { error: rpcErr } = await (client as any).rpc('cancel_customer_delivery_order', {
                target_order_id: order.id,
              });

              if (rpcErr) {
                // Repli direct si la RPC n'est pas encore déployée
                const { error: orderErr } = await (client as any)
                  .from('delivery_orders')
                  .update({ status: 'cancelled' })
                  .eq('id', order.id)
                  .in('status', ['confirmed', 'searching_driver']);
                if (orderErr) throw orderErr;

                await (client as any)
                  .from('driver_missions')
                  .update({ status: 'cancelled' })
                  .eq('delivery_order_id', order.id);
              }

              setOrder((prev) => ({ ...prev, status: 'cancelled' }));
            } catch (err: any) {
              Alert.alert('Annulation impossible', err?.message || 'Veuillez réessayer.');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  };

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

      {!hasLoadedRealOrder ? (
        <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Chargement de votre commande…
          </Text>
        </View>
      ) : (
        <>
          {/* Live Map */}
          <LiveTrackingMap
            customerLocation={order.destination.location}
            customerAddress={order.destination.address}
            driver={order.driver}
            driverLocation={driverLocation}
            pickupStops={order.stops}
            height={360}
          />

          {/* Status Card */}
          <DeliveryStatusCard order={order} />

          {/* Driver Card */}
          <DriverInfoCard
            driver={order.driver}
            roleDescription="Livreur REDGO"
            isAssigned={Boolean(order.driver)}
          />

          {/* Timeline with only relevant stages */}
          <OrderStatusTimeline
            currentStage={order.status}
            hasCourses={order.hasCourses}
            hasFood={order.hasFood}
          />

          {id !== 'order_default' && order.status !== 'cancelled' ? (
            <CashPaymentPanel targetType="delivery" targetId={String(id)} />
          ) : null}

          {canCancel ? (
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.85 }]}
              onPress={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.cancelButtonText}>Annuler la commande</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </>
      )}

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
  cancelButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
});

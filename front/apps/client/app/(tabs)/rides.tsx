import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { formatMillimes } from '../../services/cart';
import { requireSupabase } from '../../services/supabase';
import { RideStage } from '../../types/ride';

type RideHistoryRow = {
  id: string;
  reference: string;
  status: RideStage;
  pickup_address: string;
  destination_address: string;
  fare_millimes: number;
  created_at: string;
};

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'completed', label: 'Terminées' },
  { id: 'cancelled', label: 'Annulées' },
];

function getRideStatusMeta(status: RideStage) {
  switch (status) {
    case 'searching':
      return { label: 'Recherche chauffeur', color: colors.warning };
    case 'driver_assigned':
      return { label: 'Chauffeur assigné', color: colors.success };
    case 'approaching_pickup':
      return { label: 'En approche', color: colors.primary };
    case 'arrived_at_pickup':
      return { label: 'Sur place', color: colors.success };
    case 'ride_started':
      return { label: 'En cours', color: '#3B82F6' };
    case 'ride_completed':
      return { label: 'Terminée', color: colors.success };
    case 'cancelled':
      return { label: 'Annulée', color: colors.error };
  }
}

export default function RidesHistoryScreen() {
  const { palette } = useTheme();
  const [rides, setRides] = useState<RideHistoryRow[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRides = useCallback(async () => {
    try {
      const client = requireSupabase();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        setRides([]);
        return;
      }
      const { data, error } = await (client as any)
        .from('scooter_rides')
        .select('id, reference, status, pickup_address, destination_address, fare_millimes, created_at')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setRides(data as RideHistoryRow[]);
      }
    } catch (err) {
      console.warn('loadRides error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRides();
  }, [loadRides]);

  const filteredRides = useMemo(() => {
    if (activeTab === 'all') return rides;
    if (activeTab === 'active') {
      return rides.filter((r) => r.status !== 'ride_completed' && r.status !== 'cancelled');
    }
    if (activeTab === 'completed') {
      return rides.filter((r) => r.status === 'ride_completed');
    }
    return rides.filter((r) => r.status === 'cancelled');
  }, [rides, activeTab]);

  const openRide = (ride: RideHistoryRow) => {
    const params = {
      id: ride.id,
      reference: ride.reference,
      pickup: ride.pickup_address,
      destination: ride.destination_address,
      fare: String(ride.fare_millimes),
    };
    if (ride.status === 'searching') {
      router.push({ pathname: '/booking/searching', params });
    } else {
      router.push({ pathname: `/ride/tracking/${ride.id}`, params });
    }
  };

  return (
    <Screen
      scroll
      style={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Mes courses & colis</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Scooter Taxi et envois de colis REDGO</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, isActive && styles.activeTab]}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement de l&apos;historique…</Text>
        </View>
      ) : null}

      {!isLoading && filteredRides.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={52} color={colors.border} />
          <Text style={styles.emptyTitle}>Aucune course ou colis</Text>
          <Text style={styles.emptyText}>Vos trajets Scooter Taxi et envois de colis apparaîtront ici.</Text>
          <Pressable style={styles.ctaBtn} onPress={() => router.push('/booking/pickup')}>
            <Text style={styles.ctaText}>Commander un scooter ou colis</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.list}>
        {filteredRides.map((ride) => {
          const isParcel = ride.destination_address?.startsWith('[COLIS');
          const isRoundTrip = ride.destination_address?.startsWith('[ALLER-RETOUR]');
          const statusMeta = getRideStatusMeta(ride.status);
          const dateLabel = new Date(ride.created_at).toLocaleString('fr-TN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <Pressable key={ride.id} style={styles.card} onPress={() => openRide(ride)}>
              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  <Ionicons
                    name={isParcel ? 'cube-outline' : 'bicycle'}
                    size={14}
                    color={isParcel ? colors.warning : colors.primary}
                  />
                  <Text style={styles.typeText}>
                    {isParcel ? 'Envoi de colis' : isRoundTrip ? 'Scooter Aller-retour' : 'Scooter Taxi'}
                  </Text>
                </View>
                <Text style={styles.price}>{formatMillimes(ride.fare_millimes)}</Text>
              </View>

              <View style={styles.routeBlock}>
                <View style={styles.routeRow}>
                  <View style={styles.dotGreen} />
                  <Text style={styles.address} numberOfLines={1}>
                    {ride.pickup_address}
                  </Text>
                </View>
                <View style={styles.line} />
                <View style={styles.routeRow}>
                  <View style={styles.dotRed} />
                  <Text style={styles.address} numberOfLines={2}>
                    {ride.destination_address}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.date}>
                  {ride.reference} · {dateLabel}
                </Text>
                <Text style={[styles.status, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 18, paddingBottom: 36 },
  header: { marginTop: 16, marginBottom: 14 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  tab: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  activeTab: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  activeTabText: { color: '#fff' },
  loadingBox: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  list: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  price: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  routeBlock: { gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  line: { width: 1.5, height: 10, backgroundColor: colors.border, marginLeft: 3.2 },
  address: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 12,
  },
  date: { color: colors.textSecondary, fontSize: 11 },
  status: { fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyText: { color: colors.textSecondary, marginTop: 6, textAlign: 'center', fontSize: 13 },
  ctaBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  ctaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

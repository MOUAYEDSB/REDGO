import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { formatMillimes } from '../../services/cart';
import {
  DriverHistoryMission,
  fetchDriverHistory,
  openNavigationApp,
  subscribeDriverUpdates,
} from '../../services/driverMissions';

export default function DriverHistoryScreen() {
  const { user } = useRedgoAuth();
  const [history, setHistory] = useState<DriverHistoryMission[]>([]);
  const [filter, setFilter] = useState<'all' | 'delivery' | 'scooter_ride'>('all');
  const [period, setPeriod] = useState<'today' | 'week' | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDriverHistory(user?.id);
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      const unsubscribe = subscribeDriverUpdates(() => {
        void loadData();
      });
      return () => unsubscribe();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek - 1)).getTime();

  const filteredHistory = history.filter((item) => {
    if (filter !== 'all' && item.missionType !== filter) return false;
    const ts = new Date(item.completedAt).getTime();
    if (period === 'today') return ts >= startOfDay;
    if (period === 'week') return ts >= startOfWeek;
    return true;
  });

  const totalEarnings = filteredHistory.reduce((acc, h) => acc + h.driverEarningsMillimes, 0);
  const totalCollected = filteredHistory.reduce((acc, h) => acc + h.amountMillimes, 0);

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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Historique des courses</Text>
          <Text style={styles.subtitle}>Missions terminées & encaissements</Text>
        </View>
      </View>

      {/* Recap Banner */}
      <View style={styles.recapCard}>
        <View>
          <Text style={styles.recapLabel}>GAIN NET CHAUFFEUR</Text>
          <Text style={styles.recapValue}>{formatMillimes(totalEarnings)}</Text>
          <Text style={{ color: '#A1A1AA', fontSize: 11, marginTop: 2 }}>
            Total encaissé : {formatMillimes(totalCollected)}
          </Text>
        </View>
        <View style={styles.recapCountBadge}>
          <Text style={styles.recapCountText}>{filteredHistory.length} courses</Text>
        </View>
      </View>

      {/* Filtre période (Jour / Semaine / Tout) */}
      <View style={styles.filterRow}>
        {(
          [
            { id: 'today', label: "Aujourd'hui" },
            { id: 'week', label: 'Cette semaine' },
            { id: 'all', label: 'Tout' },
          ] as const
        ).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPeriod(p.id)}
            style={[styles.filterChip, period === p.id && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, period === p.id && styles.filterTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filtres */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Toutes</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('delivery')}
          style={[styles.filterChip, filter === 'delivery' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filter === 'delivery' && styles.filterTextActive]}>🍔 Livraisons Food & Hub</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('scooter_ride')}
          style={[styles.filterChip, filter === 'scooter_ride' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filter === 'scooter_ride' && styles.filterTextActive]}>🛵 Scooter Taxi</Text>
        </Pressable>
      </View>

      {/* Liste de l'historique */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
      ) : filteredHistory.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune course dans cette catégorie</Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {filteredHistory.map((item) => {
            const isDelivery = item.missionType === 'delivery';
            return (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.cardTop}>
                  <View style={[styles.badgeWrap, { flex: 1, marginRight: 8 }]}>
                    <View style={[styles.typeIcon, isDelivery ? styles.typeDelivery : styles.typeScooter]}>
                      <Ionicons
                        name={isDelivery ? 'restaurant-outline' : 'bicycle-outline'}
                        size={16}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reference} numberOfLines={1}>{item.reference}</Text>
                      <Text style={styles.dateText} numberOfLines={1}>
                        {item.customerName ? `${item.customerName} · ` : ''}
                        {new Date(item.completedAt).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {new Date(item.completedAt).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.earnings}>+{formatMillimes(item.driverEarningsMillimes)}</Text>
                    <Text style={styles.totalCollected}>Encaissé : {formatMillimes(item.amountMillimes)}</Text>
                  </View>
                </View>

                <View style={styles.addressLine}>
                  <Ionicons name="radio-button-on" size={13} color="#34D399" />
                  <Text style={styles.addressTxt} numberOfLines={1}>{item.pickupAddress}</Text>
                </View>

                <View style={styles.addressLine}>
                  <Ionicons name="location" size={13} color={colors.primary} />
                  <Text style={styles.addressTxt} numberOfLines={1}>{item.destinationAddress}</Text>
                </View>

                {item.items && item.items.length > 0 ? (
                  <View style={{ backgroundColor: '#121216', borderRadius: 10, padding: 8, marginTop: 8, gap: 6, borderWidth: 1, borderColor: '#23232E' }}>
                    {item.items.map((prod) => (
                      <View key={prod.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {prod.imageUrl ? (
                          <Image
                            source={{ uri: prod.imageUrl }}
                            style={{ width: 32, height: 32, borderRadius: 7, backgroundColor: '#27272A' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={{ width: 32, height: 32, borderRadius: 7, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="fast-food-outline" size={14} color="#A1A1AA" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F4F4F5', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                            {prod.quantity}x {prod.productName}
                          </Text>
                          <Text style={{ color: '#A1A1AA', fontSize: 10 }} numberOfLines={1}>
                            {prod.businessName}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {item.review ? (
                  <View style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', borderRadius: 10, padding: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.25)', gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= item.review!.rating ? 'star' : 'star-outline'}
                          size={12}
                          color={s <= item.review!.rating ? '#FBBF24' : '#52525B'}
                        />
                      ))}
                      <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '800', marginLeft: 4 }}>
                        Avis client ({item.review.rating}/5)
                      </Text>
                    </View>
                    {item.review.comment ? (
                      <Text style={{ color: '#E4E4E7', fontSize: 11, fontStyle: 'italic' }}>
                        « {item.review.comment} »
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.cardBottom}>
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.statusPillText}>Terminée & Encaissée</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#16161D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#262633',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  recapCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: '#22222D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  recapLabel: { color: '#71717A', fontSize: 10, fontWeight: '800' },
  recapValue: { color: '#34D399', fontSize: 20, fontWeight: '900', marginTop: 4 },
  recapCountBadge: {
    backgroundColor: '#1E1E26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  recapCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#14141A',
    borderWidth: 1,
    borderColor: '#22222E',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: '#fff' },

  listWrap: { gap: 12 },
  historyCard: {
    backgroundColor: '#141419',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22222C',
    padding: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  badgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeDelivery: { backgroundColor: '#B91C1C' },
  typeScooter: { backgroundColor: '#1D4ED8' },
  reference: { color: '#fff', fontSize: 13, fontWeight: '900' },
  dateText: { color: '#71717A', fontSize: 10, marginTop: 2 },
  earnings: { color: '#34D399', fontSize: 15, fontWeight: '900' },
  totalCollected: { color: '#71717A', fontSize: 10, marginTop: 2 },

  addressLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addressTxt: { color: '#D4D4D8', fontSize: 11, flex: 1 },

  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E1E27',
    paddingTop: 10,
    marginTop: 12,
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPillText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  reopenNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  reopenNavText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  emptyTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
});

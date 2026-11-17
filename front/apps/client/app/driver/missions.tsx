import { Ionicons } from '@expo/vector-icons';
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
import type { ActiveDriverMissionRow, OpenDriverMissionRow } from '@redgo/shared';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { DriverMissionMap } from '../../components/DriverMissionMap';
import {
  acceptDriverMission,
  FALLBACK_OPEN_MISSIONS,
  getMyActiveDriverMission,
  listOpenDriverMissions,
  openNavigationApp,
  subscribeDriverUpdates,
} from '../../services/driverMissions';

export default function DriverMissionsScreen() {
  const { user } = useRedgoAuth();
  const [activeMission, setActiveMission] = useState<ActiveDriverMissionRow | null>(null);
  const [missions, setMissions] = useState<OpenDriverMissionRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'delivery' | 'scooter_ride'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedMapMissionId, setSelectedMapMissionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextActive, nextOpen] = await Promise.all([
        getMyActiveDriverMission().catch(() => null),
        listOpenDriverMissions().catch(() => FALLBACK_OPEN_MISSIONS),
      ]);
      setActiveMission(nextActive);
      setMissions(nextOpen && nextOpen.length > 0 ? nextOpen : FALLBACK_OPEN_MISSIONS);
    } catch {
      setMissions(FALLBACK_OPEN_MISSIONS);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const handleAccept = async (missionId: string) => {
    setAcceptingId(missionId);
    try {
      await acceptDriverMission(missionId);
      await loadData();
      router.push('/driver/home');
    } catch {
      // Redirige vers home pour voir la mission
      router.push('/driver/home');
    } finally {
      setAcceptingId(null);
    }
  };

  const filteredMissions = missions.filter((m) => {
    if (filter === 'all') return true;
    return m.mission_type === filter;
  });

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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Missions en direct</Text>
          <Text style={styles.subtitle}>Secteur M’Saken & Messaadine</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Si mission active, alerte pour revenir à l'accueil */}
      {activeMission ? (
        <Pressable
          onPress={() => router.push('/driver/home')}
          style={styles.activeAlertCard}
        >
          <View style={styles.activeAlertDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeAlertTitle}>Mission active en cours !</Text>
            <Text style={styles.activeAlertSubtitle}>Réf : {activeMission.reference} · Cliquez pour gérer</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      {/* Filtres */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.chip, filter === 'all' && styles.chipActive]}
        >
          <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Toutes ({missions.length})</Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('delivery')}
          style={[styles.chip, filter === 'delivery' && styles.chipActive]}
        >
          <Text style={[styles.chipText, filter === 'delivery' && styles.chipTextActive]}>🍔 Food & Hub</Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('scooter_ride')}
          style={[styles.chip, filter === 'scooter_ride' && styles.chipActive]}
        >
          <Text style={[styles.chipText, filter === 'scooter_ride' && styles.chipTextActive]}>🛵 Scooter Taxi</Text>
        </Pressable>
      </View>

      {/* Liste des missions */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
      ) : filteredMissions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bicycle-outline" size={38} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune mission disponible actuellement</Text>
          <Text style={styles.emptySubtitle}>Tirez vers le bas pour rafraîchir la liste.</Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {filteredMissions.map((m) => {
            const isFood = m.mission_type === 'delivery';
            const isBusy = acceptingId === m.mission_id;
            return (
              <View key={m.mission_id} style={styles.missionCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, isFood ? styles.iconFood : styles.iconTaxi]}>
                    <Ionicons
                      name={isFood ? 'restaurant' : 'bicycle'}
                      size={18}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refText}>{m.reference}</Text>
                    <Text style={styles.typeText}>
                      {isFood ? 'LIVRAISON FOOD / COURSES' : 'COURSE SCOOTER TAXI'}
                    </Text>
                  </View>
                  <View style={styles.badgeReward}>
                    <Text style={styles.badgeRewardText}>3.500 DT</Text>
                  </View>
                </View>

                {/* Adresses */}
                <View style={styles.addressBox}>
                  <View style={styles.addrRow}>
                    <Ionicons name="radio-button-on" size={14} color="#34D399" />
                    <Text style={styles.addrTxt} numberOfLines={1}>
                      {m.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.addrRow}>
                    <Ionicons name="location" size={14} color={colors.primary} />
                    <Text style={styles.addrTxt} numberOfLines={1}>
                      {m.destination_address}
                    </Text>
                  </View>
                </View>

                {/* Carte dépliable de la mission */}
                {selectedMapMissionId === m.mission_id ? (
                  <View style={{ marginTop: 10 }}>
                    <DriverMissionMap
                      pickupAddress={m.pickup_address}
                      destinationAddress={m.destination_address}
                      height={180}
                      showExpandButton={false}
                    />
                  </View>
                ) : null}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => setSelectedMapMissionId(selectedMapMissionId === m.mission_id ? null : m.mission_id)}
                    style={[styles.navBtn, selectedMapMissionId === m.mission_id && { backgroundColor: '#2E2E3E' }]}
                  >
                    <Ionicons name="map-outline" size={16} color={selectedMapMissionId === m.mission_id ? colors.primary : '#A1A1AA'} />
                    <Text style={[styles.navBtnText, selectedMapMissionId === m.mission_id && { color: colors.primary }]}>
                      {selectedMapMissionId === m.mission_id ? 'Masquer la carte' : 'Voir sur la carte'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={isBusy}
                    onPress={() => void handleAccept(m.mission_id)}
                    style={[styles.acceptBtn, isBusy && { opacity: 0.7 }]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-sharp" size={16} color="#fff" />
                        <Text style={styles.acceptBtnText}>Accepter la course</Text>
                      </>
                    )}
                  </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#16161D',
    borderWidth: 1,
    borderColor: '#262633',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#261214',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  activeAlertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  activeAlertTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  activeAlertSubtitle: { color: '#FFB3BA', fontSize: 11, marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#14141A',
    borderWidth: 1,
    borderColor: '#22222E',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#fff' },

  listWrap: { gap: 12 },
  missionCard: {
    backgroundColor: '#141419',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22222C',
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconFood: { backgroundColor: '#B91C1C' },
  iconTaxi: { backgroundColor: '#1D4ED8' },
  refText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  typeText: { color: '#71717A', fontSize: 10, fontWeight: '700', marginTop: 2 },
  badgeReward: {
    backgroundColor: '#102B1D',
    borderWidth: 1,
    borderColor: '#155E38',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeRewardText: { color: '#34D399', fontSize: 12, fontWeight: '900' },

  addressBox: {
    backgroundColor: '#0F0F13',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrTxt: { color: '#D4D4D8', fontSize: 12, flex: 1 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C24',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#292936',
  },
  navBtnText: { color: '#D4D4D8', fontSize: 11, fontWeight: '700' },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  emptyBox: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  emptySubtitle: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
});

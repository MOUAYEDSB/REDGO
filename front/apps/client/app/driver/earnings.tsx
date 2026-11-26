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
  DriverEarningsSummary,
  DriverHistoryMission,
  fetchDriverEarningsSummary,
  fetchDriverHistory,
  subscribeDriverUpdates,
} from '../../services/driverMissions';

export default function DriverEarningsScreen() {
  const { user } = useRedgoAuth();
  const [earnings, setEarnings] = useState<DriverEarningsSummary>({
    todayMillimes: 0,
    todayCount: 0,
    weekMillimes: 0,
    weekCount: 0,
    allTimeMillimes: 0,
    allTimeCount: 0,
    cashCollectedMillimes: 0,
    rating: null,
    reviewsCount: 0,
    vehicleModel: '',
  });
  const [history, setHistory] = useState<DriverHistoryMission[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'all'>('today');
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'scooter_ride'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [summary, list] = await Promise.all([
        fetchDriverEarningsSummary(user?.id),
        fetchDriverHistory(user?.id),
      ]);
      setEarnings(summary);
      setHistory(list || []);
    } catch {
      // Ignorer
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

  const filteredMissions = history.filter((item) => {
    if (typeFilter !== 'all' && item.missionType !== typeFilter) return false;
    const ts = new Date(item.completedAt).getTime();
    if (period === 'today') return ts >= startOfDay;
    if (period === 'week') return ts >= startOfWeek;
    return true;
  });

  const filteredGainMillimes = filteredMissions.reduce((acc, m) => acc + m.driverEarningsMillimes, 0);
  const filteredCashMillimes = filteredMissions.reduce((acc, m) => acc + m.amountMillimes, 0);
  const periodLabel = period === 'today' ? "AUJOURD'HUI" : period === 'week' ? 'CETTE SEMAINE' : 'TOTAL CUMULÉ';

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
          <Text style={styles.title}>Mes Gains & Encaissements</Text>
          <Text style={styles.subtitle}>Rémunération chauffeur & espèces perçues</Text>
        </View>
      </View>

      {/* Filtres période & type */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
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
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: period === p.id ? colors.primary : '#16161D',
              borderWidth: 1,
              borderColor: period === p.id ? colors.primary : '#262633',
            }}
          >
            <Text style={{ color: period === p.id ? '#fff' : '#A1A1AA', fontSize: 12, fontWeight: '800' }}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
        {(
          [
            { id: 'all', label: 'Toutes' },
            { id: 'delivery', label: 'Livraisons' },
            { id: 'scooter_ride', label: 'Scooter Taxi' },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTypeFilter(t.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: typeFilter === t.id ? '#27272A' : '#121216',
              borderWidth: 1,
              borderColor: typeFilter === t.id ? '#52525B' : '#23232E',
            }}
          >
            <Text style={{ color: typeFilter === t.id ? '#fff' : '#71717A', fontSize: 11, fontWeight: '700' }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Hero Card : Gains filtrés */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>GAIN NET CHAUFFEUR · {periodLabel}</Text>
            <Text style={styles.heroAmount}>{formatMillimes(filteredGainMillimes)}</Text>
          </View>
          <View style={styles.heroCountPill}>
            <Text style={styles.heroCountText}>{filteredMissions.length} courses</Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroFooter}>
          <View style={styles.heroSubMetric}>
            <Text style={styles.heroSubLabel}>Semaine</Text>
            <Text style={styles.heroSubValue}>{formatMillimes(earnings.weekMillimes)}</Text>
          </View>
          <View style={styles.heroSubMetric}>
            <Text style={styles.heroSubLabel}>Total cumulé</Text>
            <Text style={styles.heroSubValue}>{formatMillimes(earnings.allTimeMillimes)}</Text>
          </View>
          <View style={styles.heroSubMetric}>
            <Text style={styles.heroSubLabel}>Note ({earnings.reviewsCount} avis)</Text>
            <Text style={styles.heroSubValue}>
              {earnings.rating !== null ? `${earnings.rating.toFixed(1)} ★` : 'Nouveau'}
            </Text>
          </View>
        </View>
      </View>

      {/* Encaissements en espèces */}
      <View style={styles.cashCard}>
        <View style={styles.cashHeader}>
          <View style={styles.cashIconWrap}>
            <Ionicons name="cash-outline" size={20} color="#34D399" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashTitle}>Espèces encaissées ({periodLabel.toLowerCase()})</Text>
            <Text style={styles.cashSubtitle}>Argent liquide collecté auprès des clients</Text>
          </View>
        </View>

        <View style={styles.cashAmountRow}>
          <Text style={styles.cashAmountBig}>{formatMillimes(filteredCashMillimes)}</Text>
          <Pressable
            onPress={() => router.push('/driver/cash-payment')}
            style={styles.qrScanBtn}
          >
            <Ionicons name="qr-code-outline" size={16} color="#fff" />
            <Text style={styles.qrScanBtnText}>Scanner QR</Text>
          </Pressable>
        </View>
        <Text style={styles.cashNote}>
          Les frais de livraison sont automatiquement déduits et vos gains nets sont crédités sur votre compte chauffeur.
        </Text>
      </View>

      {/* Détail des missions de la sélection */}
      <View style={[styles.rulesCard, { gap: 10 }]}>
        <Text style={styles.rulesTitle}>Détail des missions ({filteredMissions.length})</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : filteredMissions.length === 0 ? (
          <Text style={{ color: '#A1A1AA', fontSize: 12 }}>Aucune mission terminée pour cette sélection.</Text>
        ) : (
          filteredMissions.slice(0, 15).map((m) => (
            <View
              key={m.id}
              style={{
                backgroundColor: '#121216',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: '#23232E',
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{m.reference}</Text>
                <Text style={{ color: '#34D399', fontSize: 13, fontWeight: '900' }}>+{formatMillimes(m.driverEarningsMillimes)}</Text>
              </View>
              <Text style={{ color: '#A1A1AA', fontSize: 11 }} numberOfLines={1}>
                {m.pickupAddress} → {m.destinationAddress}
              </Text>
              {m.items && m.items.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  {m.items.slice(0, 3).map((it) => (
                    <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1C1C24', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                      {it.imageUrl ? (
                        <Image source={{ uri: it.imageUrl }} style={{ width: 18, height: 18, borderRadius: 4 }} contentFit="cover" />
                      ) : null}
                      <Text style={{ color: '#E4E4E7', fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                        {it.quantity}x {it.productName}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Règles de rémunération REDGO */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>Grille Tarifaire Chauffeur (M’Saken & Messaadine)</Text>

        <View style={styles.ruleItem}>
          <View style={styles.ruleDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ruleHeading}>🍔 Livraison Repas & Fast-Food</Text>
            <Text style={styles.ruleBody}>3.000 à 4.000 DT nets par livraison selon la distance dans la zone.</Text>
          </View>
        </View>

        <View style={styles.ruleItem}>
          <View style={styles.ruleDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ruleHeading}>🛒 Livraison Courses REDGO Hub</Text>
            <Text style={styles.ruleBody}>2.500 DT net garanti par course au départ du Hub Central.</Text>
          </View>
        </View>

        <View style={styles.ruleItem}>
          <View style={styles.ruleDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ruleHeading}>🛵 Scooter Taxi (1 passager)</Text>
            <Text style={styles.ruleBody}>85% du montant de la course vous est directement reversé.</Text>
          </View>
        </View>
      </View>

      {/* Bouton vers l'historique complet */}
      <Pressable
        onPress={() => router.push('/driver/history')}
        style={styles.fullHistoryBtn}
      >
        <Ionicons name="receipt-outline" size={18} color="#fff" />
        <Text style={styles.fullHistoryText}>Consulter le détail de chaque course</Text>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </Pressable>
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

  // Hero Card
  heroCard: {
    backgroundColor: '#15151D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262638',
    padding: 18,
    marginBottom: 16,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroAmount: { color: '#34D399', fontSize: 28, fontWeight: '900', marginTop: 6 },
  heroCountPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroCountText: { color: '#60A5FA', fontSize: 12, fontWeight: '800' },
  heroDivider: { height: 1, backgroundColor: '#242436', marginVertical: 16 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSubMetric: { alignItems: 'flex-start' },
  heroSubLabel: { color: '#71717A', fontSize: 10, fontWeight: '700' },
  heroSubValue: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 4 },

  // Cash Card
  cashCard: {
    backgroundColor: '#141419',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242430',
    padding: 16,
    marginBottom: 16,
  },
  cashHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cashIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0E281C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cashSubtitle: { color: '#71717A', fontSize: 11, marginTop: 2 },
  cashAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cashAmountBig: { color: '#fff', fontSize: 22, fontWeight: '900' },
  qrScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  qrScanBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cashNote: { color: '#71717A', fontSize: 11, lineHeight: 16 },

  // Rules Card
  rulesCard: {
    backgroundColor: '#111116',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#22222D',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  rulesTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 },
  ruleHeading: { color: '#D4D4D8', fontSize: 12, fontWeight: '800' },
  ruleBody: { color: '#71717A', fontSize: 11, lineHeight: 16, marginTop: 2 },

  fullHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A22',
    borderWidth: 1,
    borderColor: '#282838',
    borderRadius: 16,
    padding: 16,
  },
  fullHistoryText: { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1, marginHorizontal: 10 },
});

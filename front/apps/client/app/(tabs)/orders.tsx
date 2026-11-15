import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import {
  CustomerOrder,
  FALLBACK_DEMO_ORDERS,
  fetchCustomerOrders,
  formatOrderDate,
  getOrderStatusMeta,
} from '../../services/ordersHistory';

  type FilterTab = 'all' | 'active' | 'completed' | 'cancelled';

  const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
    { id: 'all', label: 'Toutes' },
    { id: 'active', label: 'En cours' },
    { id: 'completed', label: 'Livrées' },
    { id: 'cancelled', label: 'Annulées' },
  ];

  export default function OrdersScreen() {
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
      const list = await fetchCustomerOrders();
      setOrders(list);
      setIsLoading(false);
      setRefreshing(false);
    }, []);

    useEffect(() => {
      void loadData();
    }, [loadData]);

    const onRefresh = useCallback(() => {
      setRefreshing(true);
      void loadData();
    }, [loadData]);

    const activeOrdersCount = useMemo(() => {
      return orders.filter(
        (o) =>
          o.status !== 'delivered' &&
          o.status !== 'cash_collected' &&
          o.status !== 'cancelled'
      ).length;
    }, [orders]);

    const filteredOrders = useMemo(() => {
      if (activeTab === 'all') return orders;
      if (activeTab === 'active') {
        return orders.filter(
          (o) =>
            o.status !== 'delivered' &&
            o.status !== 'cash_collected' &&
            o.status !== 'cancelled'
        );
      }
      if (activeTab === 'completed') {
        return orders.filter(
          (o) => o.status === 'delivered' || o.status === 'cash_collected'
        );
      }
      if (activeTab === 'cancelled') {
        return orders.filter((o) => o.status === 'cancelled');
      }
      return orders;
    }, [orders, activeTab]);

    const displayedOrders = useMemo(() => {
      if (filteredOrders.length > 0) return filteredOrders;
      // Si la base est encore vide pour ce compte, afficher la commande de démonstration
      if (orders.length === 0 && !isLoading) {
        if (activeTab === 'all' || activeTab === 'active') {
          return FALLBACK_DEMO_ORDERS;
        }
      }
      return [];
    }, [filteredOrders, orders.length, isLoading, activeTab]);

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
            {/* Top Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Mes commandes</Text>
                <Text style={styles.subtitle}>Suivi en temps réel · M'Saken & Messaadine</Text>
              </View>
              {activeOrdersCount > 0 ? (
                <View style={styles.activeOrdersBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.activeOrdersBadgeText}>
                    {activeOrdersCount} en cours
                  </Text>
                </View>
              ) : null}
            </View>

                  {/* Tabs Filters */}
                  <View style={styles.filtersRow}>
                    {FILTER_TABS.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <Pressable
                          key={tab.id}
                          style={[styles.filterPill, isActive && styles.filterPillActive]}
                          onPress={() => setActiveTab(tab.id)}
                        >
                          <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Loading state */}
                  {isLoading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.loadingText}>Synchronisation de vos commandes…</Text>
                    </View>
                  ) : null}

                  {/* Empty State */}
                  {!isLoading && displayedOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={42} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Aucune commande trouvée</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'active'
              ? 'Vous n’avez aucune commande en cours de livraison pour le moment.'
              : 'Commandez vos courses ou vos plats préférés et suivez la livraison en direct.'}
          </Text>
          <View style={styles.emptyActionsRow}>
            <Pressable
              style={styles.emptyCtaCourses}
              onPress={() => router.push('/market')}
            >
              <Ionicons name="basket-outline" size={16} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Courses REDGO</Text>
            </Pressable>
            <Pressable
              style={styles.emptyCtaFood}
              onPress={() => router.push('/food')}
            >
              <Ionicons name="restaurant-outline" size={16} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Commander Food</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Orders List */}
      <View style={styles.ordersList}>
        {displayedOrders.map((order) => {
          const meta = getOrderStatusMeta(order.status);
          const isOngoing =
            order.status !== 'delivered' &&
            order.status !== 'cash_collected' &&
            order.status !== 'cancelled';

          return (
            <Pressable
              key={order.id}
              style={({ pressed }) => [
                styles.orderCard,
                isOngoing && styles.orderCardOngoing,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/order/[id]',
                  params: {
                    id: order.id,
                    reference: order.reference,
                    hasCourses: order.hasCourses ? '1' : '0',
                    hasFood: order.hasFood ? '1' : '0',
                  },
                })
              }
            >
              {/* Order Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.shopIconWrap}>
                    <Ionicons
                      name={
                        order.hasCourses && order.hasFood
                          ? 'sparkles-outline'
                          : order.hasFood
                          ? 'restaurant-outline'
                          : 'basket-outline'
                      }
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {order.primaryShopName}
                    </Text>
                    <View style={styles.referenceRow}>
                      <Text style={styles.referenceText}>#{order.reference}</Text>
                      <View style={styles.dotSeparator} />
                      <Text style={styles.dateText}>{formatOrderDate(order.createdAt)}</Text>
                    </View>
                  </View>
                </View>

                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={12} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>

              {/* Items Preview */}
              <View style={styles.itemsPreviewBox}>
                <View style={styles.itemsTextRow}>
                  <Text style={styles.itemsCountText}>
                    {order.itemsCount} article{order.itemsCount > 1 ? 's' : ''} :
                  </Text>
                  <Text style={styles.itemsSummaryText} numberOfLines={1}>
                    {order.items.length > 0
                      ? order.items.map((i) => `${i.quantity}x ${i.productName}`).join(' · ')
                      : 'Articles divers commandés'}
                  </Text>
                </View>

                {/* Destination snippet */}
                <View style={styles.destinationRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.destinationText} numberOfLines={1}>
                    {order.destinationAddress}
                  </Text>
                </View>
              </View>

              {/* Progress Bar (if ongoing) */}
              {isOngoing ? (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${meta.progressPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressHintText}>
                    Arrivée estimée dans 20–30 min · M'Saken
                  </Text>
                </View>
              ) : null}

              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total à payer</Text>
                  <Text style={styles.totalValue}>
                    {formatMillimes(order.totalMillimes)}
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    isOngoing ? styles.trackButton : styles.detailsButton,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/order/[id]',
                      params: {
                        id: order.id,
                        reference: order.reference,
                        hasCourses: order.hasCourses ? '1' : '0',
                        hasFood: order.hasFood ? '1' : '0',
                      },
                    })
                  }
                >
                  <Text
                    style={
                      isOngoing ? styles.trackButtonText : styles.detailsButtonText
                    }
                  >
                    {isOngoing ? 'Suivre en direct' : 'Reçu & Détails'}
                  </Text>
                  <Ionicons
                    name={isOngoing ? 'arrow-forward' : 'receipt-outline'}
                    size={14}
                    color={isOngoing ? '#FFFFFF' : colors.textSecondary}
                  />
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
                  );
}

                  const styles = StyleSheet.create({
                  screen: {
                    paddingHorizontal: 18,
                  paddingBottom: 40,
  },
                  header: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 16,
                  paddingBottom: 12,
  },
                  title: {
                    color: colors.text,
                  fontSize: 26,
                  fontWeight: '900',
                  letterSpacing: -0.3,
  },
                  subtitle: {
                    color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
  },
                  activeOrdersBadge: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#341518',
                  borderWidth: 1,
                  borderColor: '#542025',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 14,
  },
                  pulseDot: {
                    width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.primary,
  },
                  activeOrdersBadgeText: {
                    color: colors.primary,
                  fontSize: 11,
                  fontWeight: '800',
  },
                  filtersRow: {
                    flexDirection: 'row',
                  gap: 8,
                  marginVertical: 14,
  },
                  filterPill: {
                    paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
  },
                  filterPillActive: {
                    backgroundColor: colors.primary,
                  borderColor: colors.primary,
  },
                  filterText: {
                    fontSize: 12,
                  fontWeight: '700',
                  color: colors.textSecondary,
  },
                  filterTextActive: {
                    color: '#FFFFFF',
                  fontWeight: '800',
  },
                  loadingBox: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 20,
  },
                  loadingText: {
                    fontSize: 12,
                  color: colors.textSecondary,
  },
                  emptyContainer: {
                    alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 50,
                  paddingHorizontal: 20,
  },
                  emptyIconCircle: {
                    width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 16,
  },
                  emptyTitle: {
                    color: colors.text,
                  fontSize: 18,
                  fontWeight: '800',
  },
                  emptyText: {
                    color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: 'center',
                  marginTop: 6,
                  lineHeight: 18,
  },
                  emptyActionsRow: {
                    flexDirection: 'row',
                  gap: 12,
                  marginTop: 20,
  },
                  emptyCtaCourses: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
  },
                  emptyCtaFood: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#27272A',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
  },
                  emptyCtaText: {
                    color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '800',
  },
                  ordersList: {
                    gap: 14,
                  marginTop: 6,
  },
                  orderCard: {
                    backgroundColor: colors.card,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
  },
                  orderCardOngoing: {
                    borderColor: '#4A1D22',
                  backgroundColor: '#161214',
  },
                  cardHeader: {
                    flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
  },
                  cardHeaderLeft: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  flex: 1,
  },
                  shopIconWrap: {
                    width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#221416',
                  borderWidth: 1,
                  borderColor: '#3D1B1E',
                  alignItems: 'center',
                  justifyContent: 'center',
  },
                  shopInfo: {
                    flex: 1,
  },
                  shopName: {
                    color: colors.text,
                  fontSize: 15,
                  fontWeight: '800',
  },
                  referenceRow: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
  },
                  referenceText: {
                    color: colors.primary,
                  fontSize: 11,
                  fontWeight: '800',
  },
                  dotSeparator: {
                    width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: colors.textSecondary,
  },
                  dateText: {
                    color: colors.textSecondary,
                  fontSize: 11,
  },
                  statusBadge: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
  },
                  statusText: {
                    fontSize: 10,
                  fontWeight: '800',
  },
                  itemsPreviewBox: {
                    backgroundColor: '#121214',
                  borderRadius: 12,
                  padding: 10,
                  marginTop: 12,
                  gap: 6,
  },
                  itemsTextRow: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
  },
                  itemsCountText: {
                    color: colors.text,
                  fontSize: 11,
                  fontWeight: '700',
  },
                  itemsSummaryText: {
                    color: colors.textSecondary,
                  fontSize: 11,
                  flex: 1,
  },
                  destinationRow: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
  },
                  destinationText: {
                    color: colors.textSecondary,
                  fontSize: 11,
                  flex: 1,
  },
                  progressContainer: {
                    marginTop: 12,
                  gap: 6,
  },
                  progressBarTrack: {
                    height: 4,
                  backgroundColor: colors.border,
                  borderRadius: 2,
                  overflow: 'hidden',
  },
                  progressBarFill: {
                    height: '100%',
                  backgroundColor: colors.primary,
                  borderRadius: 2,
  },
                  progressHintText: {
                    fontSize: 10,
                  color: colors.textSecondary,
                  fontWeight: '600',
  },
                  cardFooter: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 12,
                  marginTop: 12,
  },
                  totalLabel: {
                    color: colors.textSecondary,
                  fontSize: 10,
  },
                  totalValue: {
                    color: colors.primary,
                  fontSize: 16,
                  fontWeight: '900',
                  marginTop: 1,
  },
                  trackButton: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
  },
                  trackButtonText: {
                    color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: '800',
  },
                  detailsButton: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
  },
                  detailsButtonText: {
                    color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: '700',
  },
});

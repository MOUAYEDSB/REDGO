import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToMyNotifications,
  UserNotification,
} from '../../services/notifications';

function getNotifVisual(category: UserNotification['category']) {
  switch (category) {
    case 'order':
      return { icon: 'receipt-outline' as const, color: '#FF202A' };
    case 'ride':
      return { icon: 'bicycle-outline' as const, color: '#38BDF8' };
    case 'mission':
      return { icon: 'flash-outline' as const, color: '#34D399' };
    case 'payment':
      return { icon: 'cash-outline' as const, color: '#22C55E' };
    case 'review':
      return { icon: 'star' as const, color: '#FBBF24' };
  }
}

export default function NotificationsScreen() {
  const { user } = useRedgoAuth();
  const { palette } = useTheme();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const list = await fetchMyNotifications(50);
    setItems(list);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      if (!user?.id) return;
      return subscribeToMyNotifications(
        user.id,
        (newItem) => {
          setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
        },
        () => void loadData(),
      );
    }, [loadData, user?.id]),
  );

  const unreadCount = items.filter((i) => !i.isRead).length;

  const handlePressNotif = async (notif: UserNotification) => {
    if (!notif.isRead) {
      setItems((prev) => prev.map((i) => (i.id === notif.id ? { ...i, isRead: true } : i)));
      await markNotificationAsRead(notif.id);
    }
    if (notif.targetRoute) {
      router.push(notif.targetRoute as any);
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    await markAllNotificationsAsRead(user?.id);
  };

  return (
    <Screen
      scroll
      style={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadData();
          }}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Alertes en temps réel · Commandes & courses
          </Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            onPress={() => void handleMarkAllRead()}
            style={[styles.markAllBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.markAllText, { color: palette.primary }]}>Tout lire</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={palette.primary} style={{ marginVertical: 40 }} />
      ) : items.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Ionicons name="notifications-off-outline" size={38} color={palette.textSecondary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Aucune notification</Text>
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            Vos notifications de suivi de commande, courses et paiements apparaîtront ici en direct.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10, paddingBottom: 30 }}>
          {items.map((notif) => {
            const visual = getNotifVisual(notif.category);
            return (
              <Pressable
                key={notif.id}
                onPress={() => void handlePressNotif(notif)}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: notif.isRead ? palette.border : palette.primary,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${visual.color}1F` }]}>
                  <Ionicons name={visual.icon} size={20} color={visual.color} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.topRow}>
                    <Text style={[styles.notifTitle, { color: palette.text }]} numberOfLines={1}>
                      {notif.title}
                    </Text>
                    {!notif.isRead ? <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} /> : null}
                  </View>
                  <Text style={[styles.notifBody, { color: palette.textSecondary }]}>
                    {notif.body}
                  </Text>
                  <Text style={[styles.time, { color: palette.textSecondary }]}>
                    {new Date(notif.createdAt).toLocaleString('fr-TN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
    gap: 10,
  },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  markAllText: { fontSize: 12, fontWeight: '800' },
  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notifTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  time: { fontSize: 11, marginTop: 6 },
});

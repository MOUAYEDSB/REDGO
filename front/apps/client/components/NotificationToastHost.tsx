import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  markNotificationAsRead,
  subscribeToMyNotifications,
  UserNotification,
} from '../services/notifications';
import { getNotificationPrefs } from '../services/profileSettings';

export function NotificationToastHost() {
  const { user } = useRedgoAuth();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeNotif, setActiveNotif] = useState<UserNotification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToMyNotifications(user.id, async (notif) => {
      const prefs = await getNotificationPrefs();
      if (notif.category === 'order' || notif.category === 'ride') {
        if (!prefs.orderUpdates) return;
      }
      if (notif.category === 'mission') {
        if (!prefs.driverAlerts) return;
      }

      setActiveNotif(notif);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveNotif(null);
      }, 4200);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user?.id]);

  if (!activeNotif) return null;

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    activeNotif.category === 'review'
      ? 'star'
      : activeNotif.category === 'mission'
        ? 'bicycle'
        : activeNotif.category === 'payment'
          ? 'cash-outline'
          : 'notifications';

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: Math.max(insets.top, 10) + 6 }]}>
      <Pressable
        onPress={() => {
          const target = activeNotif.targetRoute;
          void markNotificationAsRead(activeNotif.id);
          setActiveNotif(null);
          if (target) {
            router.push(target as any);
          }
        }}
        style={[
          styles.toast,
          {
            backgroundColor: palette.card,
            borderColor: palette.primary,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 32, 42, 0.14)' }]}>
          <Ionicons name={iconName} size={18} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {activeNotif.title}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]} numberOfLines={2}>
            {activeNotif.body}
          </Text>
        </View>
        <Pressable onPress={() => setActiveNotif(null)} hitSlop={10}>
          <Ionicons name="close" size={18} color={palette.textSecondary} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
  },
  body: {
    fontSize: 12,
    marginTop: 2,
  },
});

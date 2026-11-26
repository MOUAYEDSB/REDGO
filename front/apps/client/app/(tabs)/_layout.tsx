import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { supabase } from '../../services/supabase';

export default function TabsLayout() {
  const { user } = useRedgoAuth();
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeRidesCount, setActiveRidesCount] = useState(0);

  const refreshActiveCounts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setActiveOrdersCount(0);
      setActiveRidesCount(0);
      return;
    }

    try {
      const [ordersRes, ridesRes] = await Promise.all([
        (supabase as any)
          .from('delivery_orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .not('status', 'in', '("delivered","cash_collected","cancelled")'),
        (supabase as any)
          .from('scooter_rides')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .not('status', 'in', '("ride_completed","cancelled")'),
      ]);

      if (!ordersRes.error && typeof ordersRes.count === 'number') {
        setActiveOrdersCount(ordersRes.count);
      }
      if (!ridesRes.error && typeof ridesRes.count === 'number') {
        setActiveRidesCount(ridesRes.count);
      }
    } catch {
      // Ignorer les erreurs réseau temporaires
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshActiveCounts();
    if (!supabase || !user?.id) return;

    const interval = setInterval(() => {
      void refreshActiveCounts();
    }, 5000);

    const channel = supabase
      .channel(`tabs-active-badge-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_orders' },
        () => void refreshActiveCounts(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scooter_rides' },
        () => void refreshActiveCounts(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase?.removeChannel(channel);
    };
  }, [user?.id, refreshActiveCounts]);

  const iconSize = 22;
  const tabColor = (color: string | null | number | object | undefined) =>
    typeof color === 'string' ? color : colors.textSecondary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 70,
          paddingTop: 6,
          backgroundColor: colors.secondary,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarBadgeStyle: {
          backgroundColor: colors.primary,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '800',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={tabColor(color)} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} color={tabColor(color)} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Mes commandes',
          tabBarBadge: activeOrdersCount > 0 ? activeOrdersCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} color={tabColor(color)} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Mes courses',
          tabBarBadge: activeRidesCount > 0 ? activeRidesCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} color={tabColor(color)} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              color={tabColor(color)}
              size={iconSize}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={tabColor(color)} size={iconSize} />
          ),
        }}
      />
    </Tabs>
  );
}

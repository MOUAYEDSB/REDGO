import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  NotificationPreferences,
  saveNotificationPrefs,
} from '../../services/profileSettings';

export default function NotificationsScreen() {
  const { palette } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    void getNotificationPrefs().then(setPrefs);
  }, []);

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void saveNotificationPrefs(next);
      return next;
    });
  };

  const rows: Array<{ key: keyof NotificationPreferences; title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    {
      key: 'orderUpdates',
      title: 'Suivi en temps réel',
      subtitle: 'Statut des commandes, courses et assignation chauffeur',
      icon: 'notifications-outline',
    },
    {
      key: 'driverAlerts',
      title: 'Alertes missions & arrivée',
      subtitle: 'Nouvelles missions disponibles et arrivée à destination',
      icon: 'bicycle-outline',
    },
    {
      key: 'promotions',
      title: 'Offres & nouveautés REDGO',
      subtitle: 'Annonces et promotions à M’Saken & Messaadine',
      icon: 'pricetag-outline',
    },
    {
      key: 'soundEnabled',
      title: 'Sons & vibrations',
      subtitle: 'Signal sonore lors des alertes importantes',
      icon: 'volume-high-outline',
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {rows.map((row, idx) => (
            <View
              key={row.key}
              style={[
                styles.row,
                idx < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.border },
              ]}
            >
              <Ionicons name={row.icon} size={20} color={palette.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: palette.text }]}>{row.title}</Text>
                <Text style={[styles.rowSub, { color: palette.textSecondary }]}>{row.subtitle}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={() => togglePref(row.key)}
                trackColor={{ false: '#3F3F46', true: palette.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900', flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 11, marginTop: 2 },
});

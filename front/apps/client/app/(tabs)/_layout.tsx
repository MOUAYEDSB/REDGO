import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../constants/theme';

export default function TabsLayout() {
  const iconSize = 22;
  const tabColor = (color: string | null | number | object | undefined) =>
    typeof color === 'string' ? color : colors.textSecondary;
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { height: 70, paddingTop: 6, backgroundColor: colors.secondary, borderTopColor: colors.border }, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary }}><Tabs.Screen name="home" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={tabColor(color)} size={iconSize} /> }} /><Tabs.Screen name="explore" options={{ title: 'Explorer', tabBarIcon: ({ color }) => <Ionicons name="grid-outline" color={tabColor(color)} size={iconSize} /> }} /><Tabs.Screen name="orders" options={{ title: 'Mes commandes', tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" color={tabColor(color)} size={iconSize} /> }} /><Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" color={tabColor(color)} size={iconSize} /> }} /><Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={tabColor(color)} size={iconSize} /> }} /></Tabs>;
}

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function DriverLayout() {
  const { palette } = useTheme();
  const iconSize = 22;
  const tabColor = (color: string | null | number | object | undefined) =>
    typeof color === 'string' ? color : palette.textSecondary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: palette.secondary,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={tabColor(color)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: 'Missions',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" color={tabColor(color)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" color={tabColor(color)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Gains',
          tabBarIcon: ({ color }) => <Ionicons name="cash-outline" color={tabColor(color)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={tabColor(color)} size={iconSize} />,
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="cash-payment" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

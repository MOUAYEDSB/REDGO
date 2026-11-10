import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export default function Splash() {
  useEffect(() => { const timer = setTimeout(() => router.replace('/onboarding'), 1400); return () => clearTimeout(timer); }, []);
  return <View style={styles.container}><View style={styles.logo}><Text style={styles.logoText}>R</Text></View><Text style={styles.brand}>REDGO</Text><ActivityIndicator color={colors.primary} style={{ marginTop: 28 }} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, logo: { width: 86, height: 86, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#fff', fontSize: 48, fontWeight: '900' }, brand: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 5, marginTop: 18 } });

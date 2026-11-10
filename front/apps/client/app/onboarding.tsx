import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/ui';
import { colors } from '../constants/theme';

const pages = [
  { title: 'Your city, your way.', text: 'Discover convenient transportation around you.', icon: '↗' },
  { title: 'Ride in real time.', text: 'Book taxis and scooters whenever you need them.', icon: '🚕' },
  { title: 'Move with confidence.', text: 'Follow your driver and enjoy a simple ride experience.', icon: '✓' },
];
export default function Onboarding() {
  const [page, setPage] = useState(0);
  const current = pages[page];
  return <Screen style={styles.screen}><Pressable style={styles.skip} onPress={() => router.replace('/(auth)/login')}><Text style={styles.skipText}>Passer</Text></Pressable><View style={styles.visual}><Text style={styles.icon}>{current.icon}</Text></View><View style={styles.copy}><Text style={styles.title}>{current.title}</Text><Text style={styles.description}>{current.text}</Text><View style={styles.dots}>{pages.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.activeDot]} />)}</View><Button title={page === 2 ? 'Commencer' : 'Continuer'} onPress={() => page === 2 ? router.replace('/(auth)/login') : setPage(page + 1)} /></View></Screen>;
}
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24 }, skip: { alignSelf: 'flex-end', padding: 12 }, skipText: { color: colors.textSecondary, fontWeight: '700' },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center' }, icon: { fontSize: 82 },
  copy: { paddingBottom: 28 }, title: { color: colors.text, fontSize: 34, lineHeight: 42, fontWeight: '900', textAlign: 'center' },
  description: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginVertical: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border }, activeDot: { width: 24, backgroundColor: colors.primary },
});

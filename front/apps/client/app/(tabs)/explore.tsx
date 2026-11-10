import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

const services = [
  { title: 'Restaurants & cuisines', icon: 'restaurant-outline', route: '/food', color: '#9A3412' },
  { title: 'Pharmacie', icon: 'medkit-outline', route: '/market', color: '#166534' },
  { title: 'Marché local', icon: 'storefront-outline', route: '/market', color: '#7C2D12' },
  { title: 'Produits essentiels', icon: 'basket-outline', route: '/market', color: '#3F3F46' },
];

export default function Explore() {
  return <Screen scroll style={styles.screen}><Text style={styles.title}>Explorer</Text><Text style={styles.subtitle}>Tout ce dont vous avez besoin autour de vous.</Text><View style={styles.search}><Ionicons name="search-outline" size={20} color={colors.textSecondary} /><Text style={styles.searchText}>Restaurants, produits, pharmacies...</Text></View><View style={styles.grid}>{services.map((service) => <Pressable key={service.title} style={[styles.service, { borderColor: service.color }]} onPress={() => router.push(service.route as never)}><View style={[styles.icon, { backgroundColor: service.color }]}><Ionicons name={service.icon as any} size={26} color="#fff" /></View><Text style={styles.serviceTitle}>{service.title}</Text></Pressable>)}</View><Text style={styles.section}>Catégories populaires</Text><View style={styles.categories}>{['Pizza', 'Tunisien', 'Pharmacie', 'Hygiene', 'Snacks', 'Boissons'].map((name) => <View key={name} style={styles.category}><Ionicons name="pricetag-outline" size={18} color={colors.primary} /><Text style={styles.categoryText}>{name}</Text></View>)}</View></Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 18 },
  subtitle: { color: colors.textSecondary, marginTop: 6, marginBottom: 18 }, search: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchText: { color: colors.textSecondary }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }, service: { width: '48%', height: 136, borderRadius: 18, borderWidth: 1, backgroundColor: colors.card, padding: 16 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, serviceTitle: { color: colors.text, fontWeight: '800', lineHeight: 20, marginTop: 16 },
  section: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 28 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 13, height: 38 }, categoryText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});

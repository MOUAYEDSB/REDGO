import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

const tabs = ['Toutes', 'À venir', 'Terminées', 'Annulées'];
const rides = [{ id: 'RG2401', type: 'Taxi', from: 'Centre-ville', to: 'La Marsa', date: 'Aujourd’hui, 14:30', price: '18.500 TND', status: 'Terminée' }];
export default function Rides() {
  const [active, setActive] = useState(0);
  return <Screen style={{ paddingHorizontal: 20 }}><Text style={styles.title}>Mes courses</Text><View style={styles.tabs}>{tabs.map((tab, index) => <Pressable key={tab} onPress={() => setActive(index)} style={[styles.tab, active === index && styles.activeTab]}><Text style={[styles.tabText, active === index && styles.activeTabText]}>{tab}</Text></Pressable>)}</View>{active === 2 ? rides.map((ride) => <Pressable key={ride.id} style={styles.card} onPress={() => router.push('/ride/RG2401')}><View style={styles.cardHeader}><Text style={styles.type}>🚕 {ride.type}</Text><Text style={styles.price}>{ride.price}</Text></View><View style={styles.route}><Ionicons name="radio-button-on" size={13} color={colors.primary} /><View style={styles.line} /><Ionicons name="location" size={15} color={colors.success} /></View><View style={styles.addresses}><View><Text style={styles.address}>{ride.from}</Text><Text style={styles.address}>{ride.to}</Text></View></View><View style={styles.cardFooter}><Text style={styles.date}>{ride.date}</Text><Text style={styles.status}>{ride.status}</Text></View></Pressable>) : <View style={styles.empty}><Ionicons name="car-outline" size={52} color={colors.border} /><Text style={styles.emptyTitle}>Aucune course</Text><Text style={styles.emptyText}>Vos courses apparaîtront ici.</Text></View>}</Screen>;
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 18 }, tabs: { flexDirection: 'row', gap: 6, marginBottom: 20 }, tab: { paddingHorizontal: 10, height: 36, borderRadius: 18, backgroundColor: colors.card, justifyContent: 'center' }, activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, activeTabText: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between' }, type: { color: colors.text, fontWeight: '800' }, price: { color: colors.text, fontWeight: '800' }, route: { position: 'absolute', left: 19, top: 55, height: 42, alignItems: 'center' }, line: { width: 1, height: 24, backgroundColor: colors.border }, addresses: { marginLeft: 25, marginTop: 16, gap: 16 }, address: { color: colors.textSecondary, fontSize: 13, height: 28 }, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 12 }, date: { color: colors.textSecondary, fontSize: 12 }, status: { color: colors.success, fontSize: 12, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 12 }, emptyText: { color: colors.textSecondary, marginTop: 6 },
});

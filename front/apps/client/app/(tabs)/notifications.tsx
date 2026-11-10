import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

export default function Notifications() {
  return <Screen style={{ paddingHorizontal: 20 }}><Text style={styles.title}>Notifications</Text><View style={styles.notification}><View style={styles.icon}><Ionicons name="checkmark" size={20} color={colors.success} /></View><View style={styles.copy}><Text style={styles.notificationTitle}>Course terminée</Text><Text style={styles.notificationText}>Votre course vers La Marsa a été terminée.</Text><Text style={styles.time}>Aujourd’hui · 14:52</Text></View></View><View style={styles.notification}><View style={styles.icon}><Ionicons name="car-outline" size={20} color={colors.primary} /></View><View style={styles.copy}><Text style={styles.notificationTitle}>Bienvenue sur REDGO</Text><Text style={styles.notificationText}>Votre compte est prêt. Où allez-vous aujourd’hui ?</Text><Text style={styles.time}>Hier · 09:18</Text></View></View></Screen>;
}
const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 18 }, notification: { flexDirection: 'row', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, notificationTitle: { color: colors.text, fontWeight: '800' }, notificationText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 }, time: { color: '#666', fontSize: 11, marginTop: 8 } });

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

export default function Orders() {
  return (
    <Screen style={styles.screen}>
      <Text style={styles.title}>Mes commandes</Text>
      <View style={styles.filters}>
        {['Courses', 'Livraisons', 'Marché'].map((filter, index) => (
          <Pressable key={filter} style={[styles.filter, index === 1 && styles.active]}>
            <Text style={[styles.filterText, index === 1 && styles.activeText]}>{filter}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.card} onPress={() => router.push('/tracking/RG-1048')}>
        <View style={styles.cardHeader}>
          <View style={styles.typeIcon}>
            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.business}>Karma Kitchen</Text>
            <Text style={styles.reference}>Commande #RG-1048</Text>
          </View>
          <Text style={styles.status}>Préparation</Text>
        </View>
        <View style={styles.route}>
          <Text style={styles.product}>2 articles</Text>
          <Text style={styles.product}>•</Text>
          <Text style={styles.price}>24.800 TND</Text>
        </View>
        <View style={styles.progress}>
          <View style={styles.progressDone} />
        </View>
        <Text style={styles.time}>Arrivée estimée dans 25–35 min</Text>
      </Pressable>
      <View style={styles.empty}>
        <Ionicons name="receipt-outline" size={52} color={colors.border} />
        <Text style={styles.emptyTitle}>Autres commandes</Text>
        <Text style={styles.emptyText}>Vos courses et livraisons apparaîtront ici.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 18 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 18 }, filter: { height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, justifyContent: 'center' }, active: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' }, activeText: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16 }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, typeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, business: { color: colors.text, fontWeight: '800' }, reference: { color: colors.textSecondary, fontSize: 11, marginTop: 4 }, status: { color: colors.warning, fontSize: 11, fontWeight: '800' }, route: { flexDirection: 'row', gap: 7, marginTop: 16 }, product: { color: colors.textSecondary }, price: { color: colors.text, fontWeight: '800' },
  progress: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 18 }, progressDone: { width: '45%', height: 4, borderRadius: 2, backgroundColor: colors.primary }, time: { color: colors.textSecondary, fontSize: 12, marginTop: 10 }, empty: { alignItems: 'center', marginTop: 70 }, emptyTitle: { color: colors.text, fontWeight: '800', marginTop: 12 }, emptyText: { color: colors.textSecondary, fontSize: 13, marginTop: 5 },
});

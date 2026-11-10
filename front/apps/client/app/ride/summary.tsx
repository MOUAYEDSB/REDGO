import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Card } from '../../components/ui';
import { colors } from '../../constants/theme';

export default function RideSummary() {
  const {
    pickupAddress = 'M\'saken, avenue principale',
    destinationAddress = 'Messaadine, marché central',
  } = useLocalSearchParams<{ pickupAddress?: string; destinationAddress?: string }>();

  return <Screen scroll style={styles.screen}><Text style={styles.title}>Votre course</Text><Card><Text style={styles.label}>DÉPART</Text><Text style={styles.address}>{pickupAddress}</Text><Text style={[styles.label, { marginTop: 18 }]}>DESTINATION</Text><Text style={styles.address}>{destinationAddress}</Text></Card><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>4.8 km</Text><Text style={styles.metricLabel}>Distance</Text></View><View style={styles.metric}><Text style={styles.metricValue}>12 min</Text><Text style={styles.metricLabel}>Durée estimée</Text></View><View style={styles.metric}><Text style={styles.metricValue}>6.500 TND</Text><Text style={styles.metricLabel}>Estimation</Text></View></View><View style={styles.cash}><Text style={styles.cashLabel}>Paiement</Text><Text style={styles.cashValue}>Espèces</Text></View><View style={styles.footer}><Button title="Confirmer la course" onPress={() => router.replace({ pathname: '/booking/searching', params: { pickup: pickupAddress, destination: destinationAddress } })} /></View></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingHorizontal: 20 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 22 }, label: { color: colors.textSecondary, fontSize: 10, fontWeight: '800' }, address: { color: colors.text, fontWeight: '800', marginTop: 5 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 18 }, metric: { flex: 1, height: 72, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, metricValue: { color: colors.text, fontWeight: '900', fontSize: 13 }, metricLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 6 }, cash: { height: 58, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 18 }, cashLabel: { color: colors.textSecondary }, cashValue: { color: colors.success, fontWeight: '800' }, footer: { marginTop: 28 } });

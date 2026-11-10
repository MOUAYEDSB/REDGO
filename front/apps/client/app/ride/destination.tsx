import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui';
import { colors } from '../../constants/theme';

export default function RideDestination() {
  const { pickupAddress, pickupLat, pickupLng } = useLocalSearchParams<{
    pickupAddress?: string;
    pickupLat?: string;
    pickupLng?: string;
  }>();
  const pickupParams = { pickupAddress, pickupLat, pickupLng };

  return <Screen style={styles.screen}><Text style={styles.title}>Destination</Text><View style={styles.search}><Ionicons name="search-outline" size={20} color={colors.textSecondary} /><TextInput placeholder="Où allez-vous ?" placeholderTextColor={colors.textSecondary} style={styles.input} /></View><Pressable style={styles.option} onPress={() => router.push({ pathname: '/booking/map', params: { mode: 'destination', flow: 'ride', pickup: pickupAddress, pickupLat, pickupLng } })}><Ionicons name="map-outline" size={22} color={colors.primary} /><View><Text style={styles.optionTitle}>Choisir sur la carte</Text><Text style={styles.optionText}>Touchez la carte pour placer l’arrivée</Text></View></Pressable>{["M'saken, centre commercial", 'Messaadine, marché central'].map((place) =>   <Pressable key={place} style={styles.option} onPress={() => router.push({ pathname: '/booking/map', params: { mode: 'destination', flow: 'ride', address: place, pickup: pickupAddress, pickupLat, pickupLng } })}><Ionicons name="location-outline" size={20} color={colors.primary} /><View><Text style={styles.optionTitle}>{place}</Text><Text style={styles.optionText}>Suggestion locale</Text></View></Pressable>)}<View style={styles.footer}><Button title="Voir le résumé" onPress={() => router.push({ pathname: '/ride/summary', params: pickupParams })} /></View></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingHorizontal: 20 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 22 }, search: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }, input: { flex: 1, color: colors.text }, option: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, optionTitle: { color: colors.text, fontWeight: '800' }, optionText: { color: colors.textSecondary, fontSize: 12, marginTop: 4 }, footer: { marginTop: 'auto', paddingBottom: 24 } });

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

export default function Ride() {
  return (
    <Screen style={styles.screen}>
      <Text style={styles.eyebrow}>REDGO SCOOTER</Text>
      <Text style={styles.title}>Que souhaitez-vous faire ?</Text>
      <Text style={styles.subtitle}>
        Service scooter express disponible à M'Saken et Messaadine.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/booking/pickup', params: { tripMode: 'ride' } })
        }
      >
        <View style={styles.iconWrapPrimary}>
          <Ionicons name="bicycle" size={26} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>Se déplacer</Text>
          <Text style={styles.modeDesc}>
            1 passager · Casque fourni · Trajet rapide avec chauffeur
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/booking/pickup', params: { tripMode: 'parcel' } })
        }
      >
        <View style={styles.iconWrapWarning}>
          <Ionicons name="cube-outline" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>Envoyer un colis</Text>
          <Text style={styles.modeDesc}>
            Livraison express de documents ou petits paquets de main à main
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.serviceArea}>
        <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
        <Text style={styles.serviceAreaText}>
          Tarif calculé dynamiquement selon la distance réelle · Paiement en espèces.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 },
  eyebrow: {
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 1.4,
    fontSize: 11,
    marginTop: 18,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 22 },
  modeCard: {
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 14,
  },
  pressed: { opacity: 0.82 },
  iconWrapPrimary: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapWarning: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  modeDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  serviceArea: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    padding: 14,
    marginTop: 12,
  },
  serviceAreaText: { color: colors.textSecondary, flex: 1, fontSize: 12, lineHeight: 18 },
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors } from '../constants/theme';

export default function Welcome() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
        <Text style={styles.brandName}>REDGO</Text>
      </View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>REDGO SAHEL</Text>
        <Text style={styles.title}>Vos trajets et livraisons, simplement.</Text>
        <Text style={styles.subtitle}>
          Une seule application pour commander ou rejoindre notre réseau de chauffeurs.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/role-selection')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Continuer</Text>
          <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.footerNote}>Choisissez votre espace pour commencer</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.text, fontSize: 28, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: 30 },
  eyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  title: { color: colors.text, fontSize: 40, lineHeight: 47, fontWeight: '900', marginTop: 16 },
  subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 330 },
  footer: { gap: 12 },
  primaryButton: { height: 58, borderRadius: 17, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  footerNote: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
});

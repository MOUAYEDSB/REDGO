import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';

export default function PendingApproval() {
  const { profile, roles, refreshAccess, isSubmitting } = useRedgoAuth();
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      await refreshAccess();
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de vérifier le statut.');
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
      <View style={styles.statusIcon}><Ionicons name="time-outline" size={38} color={colors.warning} /></View>
      <Text style={styles.title}>Candidature en cours d’examen</Text>
      <Text style={styles.subtitle}>
        {profile?.full_name ? `Bonjour ${profile.full_name}. ` : ''}
        Votre demande pour rejoindre les chauffeurs REDGO est enregistrée. L’accès aux missions restera fermé jusqu’à l’approbation par l’administration.
      </Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Votre compte n’est pas encore chauffeur actif</Text>
        <Text style={styles.noticeText}>Aucune mission, course ou livraison ne peut être acceptée pendant l’examen.</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={refresh} style={styles.primary}>
        {isSubmitting ? <ActivityIndicator color={colors.text} /> : <Text style={styles.primaryText}>Vérifier le statut</Text>}
      </Pressable>
      {roles.includes('client') ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)/home')}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Continuer dans l’espace client</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.replace('/')} style={styles.logout}>
        <Text style={styles.logoutText}>Retour</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 32, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  logoText: { color: colors.text, fontSize: 28, fontWeight: '900' },
  statusIcon: { width: 78, height: 78, borderRadius: 26, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 42 },
  title: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', textAlign: 'center', marginTop: 20 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  notice: { width: '100%', backgroundColor: '#251D11', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 15, padding: 14, marginTop: 22 },
  noticeTitle: { color: colors.warning, fontSize: 12, fontWeight: '900' },
  noticeText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 },
  primary: { width: '100%', height: 52, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  secondary: { width: '100%', height: 50, borderRadius: 15, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  logout: { padding: 15, marginTop: 5 },
  logoutText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  error: { width: '100%', color: colors.error, fontSize: 12, marginTop: 10 },
});

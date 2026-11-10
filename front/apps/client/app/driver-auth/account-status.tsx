import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';

export default function DriverAccountStatus() {
  const { driverApplicationStatus, roles, signOut } = useRedgoAuth();
  const [error, setError] = useState<string | null>(null);
  const isSuspended = driverApplicationStatus === 'suspended';

  const leaveAccount = async () => {
    setError(null);
    try {
      await signOut();
      router.replace('/welcome');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La déconnexion a échoué.');
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.icon}><Ionicons name={isSuspended ? 'lock-closed-outline' : 'close-circle-outline'} size={38} color={colors.error} /></View>
      <Text style={styles.title}>{isSuspended ? 'Accès chauffeur suspendu' : 'Candidature non approuvée'}</Text>
      <Text style={styles.subtitle}>
        {isSuspended
          ? 'L’accès à l’espace chauffeur est suspendu. Contactez l’administration REDGO pour plus d’informations.'
          : 'Votre candidature chauffeur n’a pas été approuvée. Aucun accès aux missions n’est accordé.'}
      </Text>
      {roles.includes('client') ? (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/home')} style={styles.primary}>
          <Text style={styles.primaryText}>Ouvrir l’espace client</Text>
        </Pressable>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={leaveAccount} style={styles.secondary}>
        <Text style={styles.secondaryText}>Se déconnecter</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 25, justifyContent: 'center', alignItems: 'center' },
  icon: { width: 80, height: 80, borderRadius: 27, backgroundColor: '#2A1417', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', textAlign: 'center', marginTop: 22 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 22 },
  primary: { width: '100%', height: 52, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  secondary: { width: '100%', height: 50, borderRadius: 15, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  error: { width: '100%', color: colors.error, fontSize: 12, marginBottom: 10 },
});

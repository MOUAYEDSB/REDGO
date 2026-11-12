import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { Screen } from '../../components/Screen';
import { PasswordInput } from '../../components/PasswordInput';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { AUTH_OTP_LENGTH } from '../../services/auth';

export default function ResetPassword() {
  const { email: routeEmail } = useLocalSearchParams<{ email?: string }>();
  const { completePasswordReset, isSubmitting } = useRedgoAuth();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const email = typeof routeEmail === 'string' ? routeEmail : '';

  const submit = async () => {
    if (!email) {
      setError('Adresse e-mail manquante. Recommencez la demande de récupération.');
      return;
    }
    if (token.length !== AUTH_OTP_LENGTH) {
      setError(`Saisissez le code de récupération à ${AUTH_OTP_LENGTH} chiffres.`);
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.');
      return;
    }
    if (password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    try {
      await completePasswordReset(email, token, password);
      router.replace('/(auth)/login');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de réinitialiser le mot de passe.');
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Nouveau mot de passe</Text>
      <Text style={styles.subtitle}>Entrez le code de récupération reçu par e-mail à {email || 'votre adresse'}.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Code à {AUTH_OTP_LENGTH} chiffres</Text>
      <TextInput
        value={token}
        onChangeText={(value) => setToken(value.replace(/\D/g, '').slice(0, AUTH_OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={AUTH_OTP_LENGTH}
        textContentType="oneTimeCode"
        style={styles.input}
        editable={!isSubmitting}
      />
      <Text style={styles.label}>Nouveau mot de passe</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        style={styles.input}
        accessibilityLabel="Nouveau mot de passe"
        editable={!isSubmitting}
      />
      <Text style={styles.label}>Confirmer le mot de passe</Text>
      <PasswordInput
        value={confirmation}
        onChangeText={setConfirmation}
        autoComplete="new-password"
        style={styles.input}
        accessibilityLabel="Confirmer le mot de passe"
        editable={!isSubmitting}
      />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void submit()} style={styles.submit}>
        <Text style={styles.submitText}>{isSubmitting ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 34 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, lineHeight: 21, marginTop: 9, marginBottom: 18 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 14 },
  input: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 15 },
  submit: { height: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontWeight: '900' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, padding: 12, backgroundColor: '#2A1417', borderRadius: 12, marginBottom: 14 },
});

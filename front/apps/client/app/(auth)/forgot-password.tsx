import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { AUTH_OTP_LENGTH, normalizeEmail } from '../../services/auth';

export default function ForgotPassword() {
  const { sendPasswordReset, isSubmitting } = useRedgoAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      const normalizedEmail = normalizeEmail(email);
      setError(null);
      await sendPasswordReset(normalizedEmail);
      router.push({ pathname: '/(auth)/reset-password', params: { email: normalizedEmail } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’envoyer l’e-mail de réinitialisation.');
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Mot de passe oublié</Text>
      <Text style={styles.subtitle}>
        Nous vous enverrons un code de récupération à {AUTH_OTP_LENGTH} chiffres par e-mail.
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Adresse e-mail</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="vous@exemple.tn"
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        style={styles.input}
        editable={!isSubmitting}
      />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void submit()} style={styles.submit}>
        <Text style={styles.submitText}>{isSubmitting ? 'Envoi…' : 'Envoyer le code'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>Retour à la connexion</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 34 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, lineHeight: 21, marginTop: 9, marginBottom: 25 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 15 },
  submit: { height: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontWeight: '900' },
  back: { alignItems: 'center', padding: 18 },
  backText: { color: colors.textSecondary, fontWeight: '700' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, padding: 12, backgroundColor: '#2A1417', borderRadius: 12, marginBottom: 14 },
});

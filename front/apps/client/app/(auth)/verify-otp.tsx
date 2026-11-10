import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';

const destinations = {
  client: '/(tabs)/home',
  driver: '/driver/home',
  pending: '/driver-auth/pending-approval',
  'account-status': '/driver-auth/account-status',
  'role-selection': '/role-selection',
} as const;

export default function VerifyOtp() {
  const { pendingVerification, verifyCode, resendCode, isSubmitting } = useRedgoAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const submit = async () => {
    if (otp.length !== 6) {
      setError('Saisissez le code à 6 chiffres.');
      return;
    }
    setError(null);
    const result = await verifyCode(otp);
    if (result.error) setError(result.error);
    else if (result.destination) router.replace(destinations[result.destination]);
  };

  const resend = async () => {
    setError(null);
    setResendMessage(null);
    try {
      await resendCode();
      setResendMessage('Un nouveau code a été envoyé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de renvoyer le code.');
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Vérification</Text>
      <Text style={styles.subtitle}>
        Entrez le code envoyé à {pendingVerification?.identifier ?? 'votre téléphone ou e-mail'}.
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {resendMessage ? <Text style={styles.success}>{resendMessage}</Text> : null}
      <TextInput
        value={otp}
        onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        accessibilityLabel="Code de vérification à six chiffres"
        style={styles.otp}
      />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={submit} style={styles.submit}>
        <Text style={styles.submitText}>{isSubmitting ? 'Vérification…' : 'Vérifier le code'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={resend} style={styles.resend}>
        <Text style={styles.resendText}>Renvoyer le code</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 34 },
  title: { color: colors.text, fontSize: 31, fontWeight: '900', marginTop: 15 },
  subtitle: { color: colors.textSecondary, lineHeight: 21, marginTop: 9, marginBottom: 25 },
  otp: { height: 64, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, textAlign: 'center', fontSize: 26, letterSpacing: 12 },
  submit: { height: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontWeight: '900' },
  resend: { padding: 18, alignItems: 'center' },
  resendText: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.error, fontSize: 12, padding: 11, backgroundColor: '#2A1417', borderRadius: 12, marginBottom: 14 },
  success: { color: colors.success, fontSize: 12, marginBottom: 12 },
});

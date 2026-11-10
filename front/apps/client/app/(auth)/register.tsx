import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function Register() {
  const { register, requestedRole, isSubmitting } = useRedgoAuth();
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim() || !identifier.trim()) {
      setError('Renseignez votre nom et votre téléphone ou e-mail.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!accepted) {
      setError('Veuillez accepter les conditions générales.');
      return;
    }

    setError(null);
    const result = await register({ fullName, identifier: identifier.trim(), password });
    if (result.error) {
      setError(result.error);
    } else if (result.requiresVerification) {
      router.push('/(auth)/verify-otp');
    } else if (result.destination) {
      router.replace(destinations[result.destination]);
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Créer un compte</Text>
      <Text style={styles.subtitle}>
        {requestedRole === 'driver'
          ? 'Créez votre compte chauffeur. L’accès aux missions sera accordé après validation.'
          : 'Rejoignez REDGO et commandez en toute simplicité.'}
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Nom complet</Text>
      <TextInput value={fullName} onChangeText={setFullName} placeholder="Votre nom" placeholderTextColor={colors.textSecondary} autoComplete="name" style={styles.input} />
      <Text style={styles.label}>Téléphone ou e-mail</Text>
      <TextInput
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="+216 20 000 000 ou nom@exemple.tn"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        style={styles.input}
      />
      <Text style={styles.label}>Mot de passe</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="8 caractères minimum" placeholderTextColor={colors.textSecondary} secureTextEntry autoComplete="new-password" style={styles.input} />
      <Text style={styles.label}>Confirmer le mot de passe</Text>
      <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Retapez le mot de passe" placeholderTextColor={colors.textSecondary} secureTextEntry autoComplete="new-password" style={styles.input} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.terms}>
        <View style={[styles.checkbox, accepted && styles.checkboxActive]} />
        <Text style={styles.termsText}>J’accepte les conditions générales de REDGO.</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.pressed]}>
        <Text style={styles.submitText}>{isSubmitting ? 'Création…' : requestedRole === 'driver' ? 'Envoyer ma candidature' : 'Créer mon compte'}</Text>
      </Pressable>
      <Text style={styles.register}>Déjà inscrit ? <Link href="/(auth)/login" style={styles.link}>Se connecter</Link></Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 25, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 7, marginTop: 13 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 14 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 17 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  submit: { height: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  register: { color: colors.textSecondary, textAlign: 'center', marginTop: 20, fontSize: 13 },
  link: { color: colors.primary, fontWeight: '900' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, padding: 12, backgroundColor: '#2A1417', borderRadius: 12 },
});

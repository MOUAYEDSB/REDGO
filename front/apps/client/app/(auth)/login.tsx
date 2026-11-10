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

export default function Login() {
  const { signIn, requestedRole, isSubmitting } = useRedgoAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Saisissez votre téléphone ou votre e-mail et votre mot de passe.');
      return;
    }
    setError(null);
    const result = await signIn(identifier.trim(), password);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.destination) router.replace(destinations[result.destination]);
  };

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
      <Text style={styles.title}>Connexion</Text>
      <Text style={styles.subtitle}>
        {requestedRole === 'driver' ? 'Connectez-vous à votre espace chauffeur.' : 'Connectez-vous à votre espace client.'}
      </Text>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Téléphone ou e-mail</Text>
      <TextInput
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="+216 20 000 000 ou nom@exemple.tn"
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
        style={styles.input}
        editable={!isSubmitting}
      />
      <Text style={styles.label}>Mot de passe</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Votre mot de passe"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        style={styles.input}
        editable={!isSubmitting}
        onSubmitEditing={submit}
      />
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={submit}
        style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
      >
        <Text style={styles.submitText}>{isSubmitting ? 'Connexion…' : 'Se connecter'}</Text>
      </Pressable>
      <Text style={styles.register}>
        Nouveau sur REDGO ?{' '}
        <Link href="/(auth)/register" style={styles.link}>Créer un compte</Link>
      </Text>
      <Pressable onPress={() => router.replace('/role-selection')} style={styles.back}>
        <Text style={styles.backText}>Changer d’espace</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28 },
  logo: { width: 56, height: 56, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900', marginTop: 24 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 27 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 15 },
  input: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 15, fontSize: 14 },
  submit: { height: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  register: { color: colors.textSecondary, textAlign: 'center', marginTop: 24, fontSize: 13 },
  link: { color: colors.primary, fontWeight: '900' },
  back: { alignItems: 'center', padding: 14 },
  backText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, padding: 12, backgroundColor: '#2A1417', borderRadius: 12 },
});

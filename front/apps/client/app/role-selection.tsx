import { Ionicons } from '@expo/vector-icons';
import type { AppRole } from '@redgo/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors } from '../constants/theme';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';

const destinations = {
  client: '/(tabs)/home',
  driver: '/driver/home',
  'driver-onboarding': '/driver-auth/onboarding',
  pending: '/driver-auth/pending-approval',
  'account-status': '/driver-auth/account-status',
  'role-selection': '/role-selection',
} as const;

export default function RoleSelection() {
  const {
    user,
    roles,
    driverApplicationStatus,
    chooseRole,
    selectRole,
    requestAccess,
    startPreview,
    isSubmitting,
  } = useRedgoAuth();
  const [error, setError] = useState<string | null>(null);

  const continueAs = async (role: AppRole, register: boolean) => {
    setError(null);
    if (!authEnabled) {
      startPreview(role);
      router.replace(destinations[role]);
      return;
    }

    if (!user) {
      chooseRole(role);
      router.push(register ? '/(auth)/register' : '/(auth)/login');
      return;
    }

    if (roles.includes(role)) {
      const selected = await selectRole(role);
      if (selected) router.replace(destinations[role]);
      return;
    }

    const result = await requestAccess(role);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.destination) router.replace(destinations[result.destination]);
  };

  const signInAs = (role: AppRole) => {
    chooseRole(role);
    router.push('/(auth)/login');
  };

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
        <Text style={styles.brandName}>REDGO</Text>
      </View>
      <Text style={styles.title}>{user ? 'Choisissez votre espace' : 'Comment souhaitez-vous utiliser REDGO ?'}</Text>
      <Text style={styles.subtitle}>
        {!authEnabled
          ? 'Mode aperçu : explorez les espaces sans créer de compte ni vous connecter.'
          : user
          ? 'Vous ne pouvez ouvrir que les espaces autorisés pour votre compte.'
          : 'Choisissez votre espace, puis connectez-vous ou créez votre compte.'}
      </Text>

      <RoleCard
        title="Espace Client"
        description="Commandez vos courses, vos repas et vos trajets en scooter."
        icon="cart-outline"
        enabled={!user || roles.includes('client')}
        actionLabel={!authEnabled ? 'Explorer l’espace client' : user ? 'Ouvrir mon espace' : 'Créer un compte client'}
        onPress={() => continueAs('client', true)}
        loginLabel="Déjà client ? Se connecter"
        onLogin={() => signInAs('client')}
        showLogin={!user && authEnabled}
        loading={isSubmitting}
      />
      <RoleCard
        title="Espace Chauffeur"
        description="Rejoignez REDGO pour les livraisons et les courses scooter."
        icon="bicycle-outline"
        enabled={!user || roles.includes('driver') || driverApplicationStatus === null}
        actionLabel={
          !authEnabled
            ? 'Explorer l’aperçu chauffeur'
            : user
            ? roles.includes('driver')
              ? 'Ouvrir mon espace'
              : driverApplicationStatus === 'pending'
                ? 'Demande en attente'
                : 'Demander l’accès chauffeur'
            : 'Candidater comme chauffeur'
        }
        onPress={() => continueAs('driver', true)}
        loginLabel="Déjà chauffeur ? Se connecter"
        onLogin={() => signInAs('driver')}
        showLogin={!user && authEnabled}
        loading={isSubmitting}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!user && authEnabled ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            chooseRole('client');
            router.push('/(auth)/login');
          }}
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>Déjà inscrit ? <Text style={styles.loginEmphasis}>Se connecter</Text></Text>
        </Pressable>
      ) : user ? (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.loginLink}>
          <Text style={styles.loginText}>Retour à mon espace autorisé</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function RoleCard({
  title,
  description,
  icon,
  enabled,
  actionLabel,
  onPress,
  loginLabel,
  onLogin,
  showLogin,
  loading,
}: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  enabled: boolean;
  actionLabel: string;
  onPress: () => void;
  loginLabel: string;
  onLogin: () => void;
  showLogin: boolean;
  loading: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.card, !enabled && styles.cardDisabled, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}><Ionicons name={icon} size={24} color={colors.primary} /></View>
        <Ionicons name="arrow-forward-circle" size={25} color={enabled ? colors.primary : colors.textSecondary} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
      <View style={styles.cardAction}><Text style={styles.cardActionText}>{loading ? 'Chargement…' : actionLabel}</Text></View>
      {showLogin ? (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={(event) => {
            event.stopPropagation();
            onLogin();
          }}
          style={styles.cardLogin}
        >
          <Text style={styles.cardLoginText}>{loginLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.text, fontSize: 25, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 2.5 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', lineHeight: 34, marginTop: 31 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 21 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  cardDisabled: { opacity: 0.45 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#351417' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cardDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 },
  cardAction: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 12 },
  cardActionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  cardLogin: { alignSelf: 'flex-start', paddingTop: 11 },
  cardLoginText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginTop: 6 },
  loginLink: { paddingVertical: 15, alignItems: 'center' },
  loginText: { color: colors.textSecondary, fontSize: 13 },
  loginEmphasis: { color: colors.primary, fontWeight: '900' },
});

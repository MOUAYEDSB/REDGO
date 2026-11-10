import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { authEnabled } from '../../services/auth';

const items: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { icon: 'person-outline', label: 'Informations personnelles' },
  { icon: 'lock-closed-outline', label: 'Mot de passe' },
  { icon: 'language-outline', label: 'Langue' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'help-circle-outline', label: 'Centre d’aide' },
];

export default function Profile() {
  const { user, profile, roles, activeRole, previewRole, selectRole, startPreview, signOut } = useRedgoAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const name = profile?.full_name || user?.user_metadata?.full_name || 'Client REDGO';
  const phone = profile?.phone || user?.phone || 'Téléphone non renseigné';
  const email = user?.email || 'E-mail non renseigné';

  const changeSpace = async () => {
    const currentRole = previewRole ?? activeRole;
    const nextRole = currentRole === 'client' ? 'driver' : 'client';
    if (!authEnabled) {
      startPreview(nextRole);
      router.replace(nextRole === 'driver' ? '/driver/home' : '/(tabs)/home');
      return;
    }
    const selected = await selectRole(nextRole);
    if (selected) router.replace(nextRole === 'driver' ? '/driver/home' : '/(tabs)/home');
  };

  const handleSignOut = async () => {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/welcome');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La déconnexion a échoué.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Profil</Text>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.identity}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.info}>{phone}</Text>
          <Text style={styles.info}>{email}</Text>
        </View>
      </View>

      <Text style={styles.section}>Compte</Text>
      {items.slice(0, 2).map((item) => (
        <ProfileItem key={item.label} icon={item.icon} label={item.label} />
      ))}
      <Text style={styles.section}>Préférences</Text>
      {items.slice(2, 4).map((item) => (
        <ProfileItem key={item.label} icon={item.icon} label={item.label} />
      ))}
      <Text style={styles.section}>Support</Text>
      {items.slice(4).map((item) => (
        <ProfileItem key={item.label} icon={item.icon} label={item.label} />
      ))}

      {(!authEnabled || (roles.includes('client') && roles.includes('driver'))) ? (
        <Pressable accessibilityRole="button" onPress={changeSpace} style={styles.switchSpace}>
          <Ionicons name="swap-horizontal-outline" size={19} color={colors.primary} />
          <Text style={styles.switchSpaceText}>
            Passer à l’espace {previewRole === 'client' || activeRole === 'client' ? 'chauffeur' : 'client'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {authEnabled ? (
        <Pressable accessibilityRole="button" disabled={isSigningOut} style={styles.logout} onPress={handleSignOut}>
          <Text style={styles.logoutText}>{isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function ProfileItem({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <Pressable accessibilityRole="button" style={styles.item}>
      <Ionicons name={icon} size={21} color={colors.textSecondary} />
      <Text style={styles.itemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginVertical: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 22 },
  identity: { flex: 1 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  info: { color: colors.textSecondary, fontSize: 12, marginTop: 5 },
  section: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { flex: 1, color: colors.text, fontWeight: '700' },
  switchSpace: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  switchSpaceText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  logout: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center', marginVertical: 22 },
  logoutText: { color: colors.error, fontWeight: '800' },
  error: { color: colors.error, fontSize: 12, marginTop: 14 },
});

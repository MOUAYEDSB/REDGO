import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authEnabled } from '../../services/auth';

export default function Profile() {
  const { user, profile, roles, activeRole, previewRole, selectRole, startPreview, signOut } = useRedgoAuth();
  const { palette, isDark, toggleTheme } = useTheme();
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
      <Text style={[styles.title, { color: palette.text }]}>Profil</Text>

      <Pressable style={styles.header} onPress={() => router.push('/profile/personal-info')}>
        <View style={styles.avatarWrap}>
          {profile?.avatar_path ? (
            <Image source={{ uri: profile.avatar_path }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.camBadge, { backgroundColor: palette.primary, borderColor: palette.background }]}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </View>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: palette.text }]}>{name}</Text>
          <Text style={[styles.info, { color: palette.textSecondary }]}>{phone}</Text>
          <Text style={[styles.info, { color: palette.textSecondary }]}>{email}</Text>
        </View>
      </Pressable>

      <Text style={[styles.section, { color: palette.textSecondary }]}>Compte</Text>
      <ProfileItem
        icon="person-outline"
        label="Informations personnelles"
        onPress={() => router.push('/profile/personal-info')}
      />
      <ProfileItem
        icon="lock-closed-outline"
        label="Mot de passe"
        onPress={() => router.push('/profile/password')}
      />

      <Text style={[styles.section, { color: palette.textSecondary }]}>Préférences</Text>
      <View style={[styles.item, { borderBottomColor: palette.border }]}>
        <Ionicons name={!isDark ? 'sunny' : 'moon-outline'} size={21} color={!isDark ? palette.primary : palette.textSecondary} />
        <Text style={[styles.itemText, { color: palette.text }]}>
          Mode clair
        </Text>
        <Switch
          value={!isDark}
          onValueChange={toggleTheme}
          trackColor={{ false: '#3F3F46', true: palette.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
      <ProfileItem
        icon="notifications-outline"
        label="Notifications"
        onPress={() => router.push('/profile/notifications')}
      />

      <Text style={[styles.section, { color: palette.textSecondary }]}>Support</Text>
      <ProfileItem
        icon="help-circle-outline"
        label="Centre d’aide"
        onPress={() => router.push({ pathname: '/profile/help', params: { role: 'client' } })}
      />

      {(!authEnabled || (roles.includes('client') && roles.includes('driver'))) ? (
        <Pressable
          accessibilityRole="button"
          onPress={changeSpace}
          style={[styles.switchSpace, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          <Ionicons name="swap-horizontal-outline" size={19} color={palette.primary} />
          <Text style={[styles.switchSpaceText, { color: palette.text }]}>
            Passer à l’espace {previewRole === 'client' || activeRole === 'client' ? 'chauffeur' : 'client'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={palette.primary} />
        </Pressable>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.error }]}>{error}</Text> : null}

      {authEnabled ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          style={[styles.logout, { borderColor: palette.error }]}
          onPress={handleSignOut}
        >
          <Text style={[styles.logoutText, { color: palette.error }]}>
            {isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function ProfileItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.item, { borderBottomColor: palette.border }]}
    >
      <Ionicons name={icon} size={21} color={palette.textSecondary} />
      <Text style={[styles.itemText, { color: palette.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', marginVertical: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 22 },
  identity: { flex: 1 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  name: { fontSize: 18, fontWeight: '800' },
  info: { fontSize: 12, marginTop: 5 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  itemText: { flex: 1, fontWeight: '700' },
  switchSpace: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  switchSpaceText: { flex: 1, fontSize: 12, fontWeight: '800' },
  logout: { height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 22 },
  logoutText: { fontWeight: '800' },
  error: { fontSize: 12, marginTop: 14 },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { updatePassword } from './auth';
import { requireSupabase } from './supabase';

export type NotificationPreferences = {
  orderUpdates: boolean;
  driverAlerts: boolean;
  promotions: boolean;
  soundEnabled: boolean;
};

const NOTIF_STORAGE_KEY = '@redgo_notification_prefs_v1';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  orderUpdates: true,
  driverAlerts: true,
  promotions: true,
  soundEnabled: true,
};

export async function getNotificationPrefs(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function saveNotificationPrefs(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs));
}

export async function uploadProfileAvatar(userId: string, localUri: string): Promise<string> {
  const client = requireSupabase();
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const filePath = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = client.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) throw new Error("Impossible d'obtenir l'URL publique de l'avatar.");

  const { error: profileError } = await (client as any)
    .from('profiles')
    .update({ avatar_path: publicUrl })
    .eq('id', userId);

  if (profileError) throw profileError;

  return publicUrl;
}

export async function updatePersonalProfile(
  userId: string,
  input: { fullName: string; phone: string },
): Promise<void> {
  const client = requireSupabase();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  if (!fullName || fullName.length < 2) {
    throw new Error('Veuillez saisir votre nom complet.');
  }

  const { error: dbError } = await (client as any)
    .from('profiles')
    .update({ full_name: fullName, phone })
    .eq('id', userId);

  if (dbError) throw dbError;

  await client.auth.updateUser({
    data: { full_name: fullName, phone },
  });
}

export async function changeAccountPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  }
  await updatePassword(newPassword);
}

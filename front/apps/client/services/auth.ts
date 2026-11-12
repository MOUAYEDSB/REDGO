import type {
  AppRole,
  DriverApplicationRow,
  ProfileRow,
} from '@redgo/shared';
import type { Session, User } from '@supabase/supabase-js';
import { requireSupabase, supabase } from './supabase';

export type RedgoAccess = {
  profile: ProfileRow | null;
  roles: AppRole[];
  driverApplication: DriverApplicationRow | null;
};

export const authConfigured = supabase !== null;
export const authEnabled = authConfigured;
export const AUTH_OTP_LENGTH = 8;

export class AuthSessionMissingError extends Error {
  constructor(message = 'Votre e-mail a été confirmé, mais Supabase n’a pas ouvert de session. Connectez-vous pour continuer.') {
    super(message);
    this.name = 'AuthSessionMissingError';
  }
}

export function normalizeTunisianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const national = digits.startsWith('216') ? digits.slice(3) : digits;
  if (!/^[24579]\d{7}$/.test(national)) {
    throw new Error('Saisissez un numéro tunisien valide de 8 chiffres.');
  }
  return `+216${national}`;
}

export async function getSessionUser(): Promise<User | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function loadRedgoAccess(userId: string, retries = 3, delayMs = 300): Promise<RedgoAccess> {
  const client = requireSupabase();
  for (let attempt = 0; attempt < retries; attempt++) {
    const [profileResult, rolesResult, applicationResult] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('user_roles').select('role').eq('user_id', userId),
      client.from('driver_applications').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (applicationResult.error) throw applicationResult.error;

    if (profileResult.data || attempt === retries - 1) {
      return {
        profile: profileResult.data,
        roles: rolesResult.data.map((row) => row.role),
        driverApplication: applicationResult.data,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { profile: null, roles: [], driverApplication: null };
}

export async function signInWithPassword(email: string, password: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase n’a retourné aucun utilisateur.');
  return data.user;
}

export async function signUpWithPassword(input: {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  role: AppRole;
}): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: normalizeEmail(input.email),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: normalizeTunisianPhone(input.phone),
        requested_role: input.role,
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('La création du compte n’a retourné aucun utilisateur.');
  if (data.session) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('La confirmation par e-mail doit être activée dans Supabase Auth avant les inscriptions.');
  }
}

export async function verifySignupOtp(email: string, token: string): Promise<Session> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = normalizeOtp(token);
  const client = requireSupabase();
  const { data, error } = await client.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'signup',
  });
  if (error) throw otpVerificationError(error);

  let session = data.session;
  if (!session) {
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    session = result.data.session;
  }
  if (!session) throw new AuthSessionMissingError();
  if (
    (data.user && session.user.id !== data.user.id)
    || session.user.email?.toLowerCase() !== normalizedEmail
  ) {
    throw new AuthSessionMissingError('La session Supabase ne correspond pas au compte confirmé. Connectez-vous pour continuer.');
  }
  return session;
}

export async function resendSignupOtp(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(normalizeEmail(email));
  if (error) throw error;
}

export async function verifyPasswordRecoveryOtp(email: string, token: string): Promise<User> {
  const normalizedToken = normalizeOtp(token);
  const { data, error } = await requireSupabase().auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizedToken,
    type: 'recovery',
  });
  if (error) throw otpVerificationError(error);
  if (!data.user) throw new Error('La vérification de récupération a échoué.');
  return data.user;
}

function normalizeOtp(token: string): string {
  const normalized = token.replace(/\D/g, '');
  if (normalized.length !== AUTH_OTP_LENGTH) {
    throw new Error(`Saisissez les ${AUTH_OTP_LENGTH} chiffres du code reçu par e-mail.`);
  }
  return normalized;
}

function otpVerificationError(error: { message: string; code?: string }) {
  const description = `${error.code ?? ''} ${error.message}`.toLowerCase();
  if (description.includes('otp_expired') || description.includes('expired') || description.includes('invalid')) {
    return new Error(
      'Ce code est invalide, a expiré ou a déjà été utilisé. Vérifiez le dernier e-mail reçu et utilisez son code. Vous pouvez aussi demander un nouveau code.',
    );
  }
  return error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Saisissez une adresse e-mail valide.');
  }
  return normalized;
}

export async function requestRoleAccess(role: AppRole): Promise<void> {
  const client = requireSupabase();
  const result = role === 'client'
    ? await client.rpc('request_client_access')
    : await client.rpc('submit_driver_application');
  if (result.error) throw result.error;
}

export async function uploadDriverPhoto(
  userId: string,
  photoType: 'profile' | 'scooter',
  uri: string,
): Promise<string> {
  const client = requireSupabase();
  const response = await fetch(uri);
  const image = await response.blob();
  if (image.size === 0) throw new Error('La photo capturée est vide. Reprenez-la.');

  const path = `${userId}/${photoType}.jpg`;
  const { error } = await client.storage
    .from('redgo-driver-documents')
    .upload(path, image, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function saveDriverApplicationProfile(input: {
  scooterBrand: string;
  scooterPhotoPath: string;
  city?: string;
  profilePhotoPath?: string | null;
}): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('save_driver_application_profile', {
    scooter_brand: input.scooterBrand.trim(),
    scooter_photo_path: input.scooterPhotoPath,
    city: input.city || 'Msaken',
    profile_photo_path: input.profilePhotoPath || '',
  });
  if (error) {
    // Fallback if DB function has previous signature without city parameter
    const fallback = await client.rpc('save_driver_application_profile', {
      scooter_brand: input.scooterBrand.trim(),
      scooter_photo_path: input.scooterPhotoPath,
      profile_photo_path: input.profilePhotoPath || '',
    });
    if (fallback.error) throw fallback.error;
  }
}

export async function signOutFromRedgo(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function subscribeToAuth(onAuthChanged: (event: string, user: User | null) => void) {
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    onAuthChanged(event, session?.user ?? null);
  });
  return data.subscription;
}

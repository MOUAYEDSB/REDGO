import type {
  AppRole,
  DriverApplicationRow,
  ProfileRow,
} from '@redgo/shared';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthChannel = 'email' | 'phone';

export type RedgoAccess = {
  profile: ProfileRow | null;
  roles: AppRole[];
  driverApplication: DriverApplicationRow | null;
};

export const authConfigured = supabase !== null;
export const authEnabled = process.env.EXPO_PUBLIC_ENABLE_AUTH === 'true' && authConfigured;

export async function getSessionUser(): Promise<User | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function loadRedgoAccess(userId: string): Promise<RedgoAccess> {
  const client = requireSupabase();
  const [profileResult, rolesResult, applicationResult] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_roles').select('role').eq('user_id', userId),
    client.from('driver_applications').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (applicationResult.error) throw applicationResult.error;

  return {
    profile: profileResult.data,
    roles: rolesResult.data.map((row) => row.role),
    driverApplication: applicationResult.data,
  };
}

export async function signInWithPassword(identifier: string, password: string): Promise<User> {
  const client = requireSupabase();
  const credentials = identifier.includes('@')
    ? { email: identifier.trim(), password }
    : { phone: identifier.replace(/\s+/g, ''), password };
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) throw error;
  if (!data.user) throw new Error('Supabase n’a retourné aucun utilisateur.');
  return data.user;
}

export async function signUpWithPassword(input: {
  identifier: string;
  password: string;
  fullName: string;
  role: AppRole;
}): Promise<{ user: User; hasSession: boolean; channel: AuthChannel }> {
  const client = requireSupabase();
  const isEmail = input.identifier.includes('@');
  const channel: AuthChannel = isEmail ? 'email' : 'phone';
  const options = {
    data: {
      full_name: input.fullName.trim(),
      requested_role: input.role,
    },
  };
  const { data, error } = isEmail
    ? await client.auth.signUp({
        email: input.identifier.trim().toLowerCase(),
        password: input.password,
        options,
      })
    : await client.auth.signUp({
        phone: input.identifier.replace(/\s+/g, ''),
        password: input.password,
        options,
      });

  if (error) throw error;
  if (!data.user) throw new Error('La création du compte n’a retourné aucun utilisateur.');
  return { user: data.user, hasSession: data.session !== null, channel };
}

export async function verifySignupOtp(identifier: string, token: string, channel: AuthChannel): Promise<User> {
  const client = requireSupabase();
  const contact = channel === 'email'
    ? { email: identifier.trim().toLowerCase(), token, type: 'email' as const }
    : { phone: identifier.replace(/\s+/g, ''), token, type: 'sms' as const };
  const { data, error } = await client.auth.verifyOtp(contact);
  if (error) throw error;
  if (!data.user) throw new Error('Le code a été accepté, mais aucun utilisateur n’a été retourné.');
  return data.user;
}

export async function resendSignupOtp(identifier: string, channel: AuthChannel): Promise<void> {
  const client = requireSupabase();
  const contact = channel === 'email'
    ? { type: 'signup' as const, email: identifier.trim().toLowerCase() }
    : { type: 'sms' as const, phone: identifier.replace(/\s+/g, '') };
  const { error } = await client.auth.resend(contact);
  if (error) throw error;
}

export async function requestRoleAccess(role: AppRole): Promise<void> {
  const client = requireSupabase();
  const result = role === 'client'
    ? await client.rpc('request_client_access')
    : await client.rpc('submit_driver_application');
  if (result.error) throw result.error;
}

export async function signOutFromRedgo(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function subscribeToAuth(onUserChanged: (user: User | null) => void) {
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onUserChanged(session?.user ?? null);
  });
  return data.subscription;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('La connexion REDGO n’est pas configurée. Renseignez les variables Supabase de l’application mobile.');
  }
  return supabase;
}

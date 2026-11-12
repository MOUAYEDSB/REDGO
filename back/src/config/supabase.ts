import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL is required to initialize the server Supabase client.');
  }
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required to initialize the server Supabase client.');
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testSupabase() {
  console.log('REDGO - Testing Supabase Backend...');

  try {
    const { error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) throw error;

    console.log('SUCCESS: Backend connected to Supabase!');
    console.log('SUCCESS: Auth Admin API accessible!');
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exitCode = 1;
  }
}

testSupabase();

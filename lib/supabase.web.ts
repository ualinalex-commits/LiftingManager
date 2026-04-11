import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On web, Supabase defaults to localStorage — no custom storage needed.
// Do NOT import @react-native-async-storage here; it references `window` at
// module load time and breaks static export builds.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY!;
export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

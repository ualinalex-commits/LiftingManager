import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// This file is used for native (iOS/Android) only.
// For web, Metro resolves lib/supabase.web.ts instead, which avoids
// importing AsyncStorage (which references `window` and breaks static builds).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY!;
export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

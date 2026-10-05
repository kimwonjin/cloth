import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env.local and fill in your project values.'
  );
}

// During static web rendering there is no `window`, so skip persistent storage there.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseKey ?? 'missing-key',
  {
    auth: {
      ...(isServer ? {} : { storage: AsyncStorage }),
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
);

// Refresh auth tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/** Pings the Supabase Auth health endpoint to verify URL and key. */
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseKey! },
    });
    return res.ok;
  } catch {
    return false;
  }
}

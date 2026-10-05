import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function isHttpUrl(value: string | undefined): value is string {
  return !!value && /^https?:\/\/[^\s/]+/.test(value);
}

export const isSupabaseConfigured = isHttpUrl(supabaseUrl) && Boolean(supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env vars are missing or invalid. EXPO_PUBLIC_SUPABASE_URL must look like ' +
      'https://<project-ref>.supabase.co and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.'
  );
}

// During static web rendering there is no `window`, so skip persistent storage there.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

// Fall back to placeholders so a bad config doesn't crash the whole app on startup.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'http://localhost:54321',
  isSupabaseConfigured ? supabaseKey! : 'missing-key',
  {
    auth: {
      ...(isServer ? {} : { storage: AsyncStorage }),
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
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

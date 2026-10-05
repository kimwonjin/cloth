import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { isValidKoreanMobile, normalizePhone, phoneCredentials } from '@/domain/phone';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
      .catch(() => setState({ session: null, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId(): string {
  const { session } = useAuth();
  return session?.user.id ?? '';
}

/**
 * TEMPORARY: signs in (or signs up) with just a phone number — no SMS check.
 * See `phoneCredentials`. Requires "Confirm email" to be OFF in Supabase Auth.
 */
export async function signInWithPhone(phone: string): Promise<{ isNewUser: boolean }> {
  if (!isValidKoreanMobile(phone)) throw new Error('휴대폰 번호를 정확히 입력해주세요.');
  const { email, password } = phoneCredentials(phone);

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) return { isNewUser: false };
  if (signIn.error.code !== 'invalid_credentials') throw new Error(signIn.error.message);

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone: normalizePhone(phone) } },
  });
  if (signUp.error) throw new Error(signUp.error.message);
  if (!signUp.data.session) {
    throw new Error(
      '가입은 됐지만 로그인되지 않았어요. Supabase Auth 설정에서 "Confirm email"을 꺼주세요.'
    );
  }
  return { isNewUser: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}

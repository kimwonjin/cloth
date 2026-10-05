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

/** Turns Supabase auth errors into messages a user can act on. */
export function authErrorMessage(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return '지금은 가입할 수 없어요. (Supabase Auth에서 이메일 가입이 꺼져 있어요)';
    case 'email_address_invalid':
      return '로그인 설정에 문제가 있어요. 관리자에게 알려주세요. (email_address_invalid)';
    case 'email_not_confirmed':
      return '가입 확인이 필요한 상태예요. Supabase Auth에서 "Confirm email"을 꺼주세요.';
  }
  if (error.status === 0 || /fetch|network/i.test(error.message)) {
    return '서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.';
  }
  return `로그인에 실패했어요. (${error.code ?? error.message})`;
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
  if (signIn.error.code !== 'invalid_credentials') throw new Error(authErrorMessage(signIn.error));

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone: normalizePhone(phone) } },
  });
  if (signUp.error) throw new Error(authErrorMessage(signUp.error));
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

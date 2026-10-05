import { authErrorMessage } from '../auth';

// jest hoists this above the import.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('authErrorMessage', () => {
  it('maps known Supabase codes to Korean guidance', () => {
    expect(authErrorMessage({ code: 'over_request_rate_limit', message: '' })).toContain('잠시 후');
    expect(authErrorMessage({ code: 'email_not_confirmed', message: '' })).toContain('Confirm email');
    expect(authErrorMessage({ code: 'signup_disabled', message: '' })).toContain('가입할 수 없어요');
  });

  it('detects network failures', () => {
    expect(authErrorMessage({ message: 'Failed to fetch', status: 0 })).toContain('인터넷');
  });

  it('falls back to the code for unknown errors', () => {
    expect(authErrorMessage({ code: 'weird', message: 'x' })).toContain('weird');
  });
});

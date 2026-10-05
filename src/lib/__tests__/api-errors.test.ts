import { apiErrorMessage } from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/image-processing', () => ({ toUploadBody: jest.fn() }));

describe('apiErrorMessage', () => {
  it('explains missing rows (deleted or made private)', () => {
    expect(apiErrorMessage({ code: 'PGRST116', message: 'JSON object requested...' })).toContain('찾을 수 없어요');
  });
  it('explains permission and duplicate errors', () => {
    expect(apiErrorMessage({ code: '42501', message: 'new row violates row-level security policy' })).toBe('권한이 없어요.');
    expect(apiErrorMessage({ code: '23505', message: 'duplicate key' })).toContain('이미');
  });
  it('explains network failures', () => {
    expect(apiErrorMessage({ message: 'TypeError: Failed to fetch' })).toContain('인터넷');
  });
});

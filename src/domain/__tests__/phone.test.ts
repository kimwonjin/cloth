import { formatPhone, isValidKoreanMobile, normalizePhone, phoneCredentials } from '../phone';

describe('phone', () => {
  it('normalizes dashes, spaces and +82', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone(' 010 1234 5678 ')).toBe('01012345678');
    expect(normalizePhone('+82 10-1234-5678')).toBe('01012345678');
  });

  it('validates Korean mobile numbers', () => {
    expect(isValidKoreanMobile('010-1234-5678')).toBe(true);
    expect(isValidKoreanMobile('011-123-4567')).toBe(true);
    expect(isValidKoreanMobile('02-123-4567')).toBe(false);
    expect(isValidKoreanMobile('010-1234')).toBe(false);
    expect(isValidKoreanMobile('')).toBe(false);
  });

  it('formats while typing', () => {
    expect(formatPhone('010')).toBe('010');
    expect(formatPhone('0101234')).toBe('010-1234');
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
    expect(formatPhone('0111234567')).toBe('011-123-4567');
  });

  it('maps the same number to the same credentials regardless of format', () => {
    expect(phoneCredentials('010-1234-5678')).toEqual(phoneCredentials('+821012345678'));
    expect(phoneCredentials('01012345678').email).toBe('u01012345678@phone.mycloset.app');
    expect(phoneCredentials('01012345678').password.length).toBeGreaterThanOrEqual(6);
  });
});

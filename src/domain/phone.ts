/** Strips everything but digits and converts +82 numbers to the domestic 0-prefixed form. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

/** Korean mobile numbers: 010/011/016/017/018/019 followed by 7–8 digits. */
export function isValidKoreanMobile(input: string): boolean {
  return /^01[016789]\d{7,8}$/.test(normalizePhone(input));
}

/** 01012345678 -> 010-1234-5678 (formats partial input while typing too). */
export function formatPhone(input: string): string {
  const d = normalizePhone(input).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * TEMPORARY phone login (no SMS verification yet): the phone number maps to a
 * synthetic email + password. Anyone who knows a number can sign in as it, so
 * replace this with Supabase phone OTP before launch.
 */
export function phoneCredentials(phone: string) {
  const digits = normalizePhone(phone);
  return {
    email: `u${digits}@phone.mycloset.app`,
    password: `mycloset-phone-${digits}`,
  };
}

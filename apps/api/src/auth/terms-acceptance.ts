export const TERMS_VERSION = '2026-11-05';

export interface TermsAcceptance {
  termsAcceptedAt: Date;
  termsVersion: string;
}

export function termsAcceptance(
  billing: boolean,
  now = new Date(),
): TermsAcceptance | Record<string, never> {
  return billing ? { termsAcceptedAt: now, termsVersion: TERMS_VERSION } : {};
}

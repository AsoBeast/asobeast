import { TERMS_VERSION, termsAcceptance } from './terms-acceptance';

const NOW = new Date('2026-11-08T10:00:00.000Z');

describe('termsAcceptance', () => {
  it('records nothing without billing', () => {
    expect(termsAcceptance(false, NOW)).toEqual({});
  });

  it('records the moment and the version with billing', () => {
    expect(termsAcceptance(true, NOW)).toEqual({
      termsAcceptedAt: NOW,
      termsVersion: TERMS_VERSION,
    });
  });
});

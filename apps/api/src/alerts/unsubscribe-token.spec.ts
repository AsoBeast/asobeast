import { isUnsubscribeToken, unsubscribeToken } from './unsubscribe-token';

const SECRET = 'a'.repeat(32);
const OPS = { alertId: 'ea_1', email: 'ops@example.com' };

describe('unsubscribe token', () => {
  it('is the same for the same recipient and secret', () => {
    expect(unsubscribeToken(SECRET, OPS)).toBe(unsubscribeToken(SECRET, OPS));
  });

  it('ignores the case of the address', () => {
    expect(unsubscribeToken(SECRET, { ...OPS, email: 'Ops@Example.com' })).toBe(
      unsubscribeToken(SECRET, OPS),
    );
  });

  it('differs per alert, per address and per secret', () => {
    const token = unsubscribeToken(SECRET, OPS);
    expect(unsubscribeToken(SECRET, { ...OPS, alertId: 'ea_2' })).not.toBe(
      token,
    );
    expect(
      unsubscribeToken(SECRET, { ...OPS, email: 'team@example.com' }),
    ).not.toBe(token);
    expect(unsubscribeToken('b'.repeat(32), OPS)).not.toBe(token);
  });

  it('is 43 characters of base64url', () => {
    expect(unsubscribeToken(SECRET, OPS)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('accepts only the token minted for that recipient', () => {
    const token = unsubscribeToken(SECRET, OPS);
    expect(isUnsubscribeToken(SECRET, OPS, token)).toBe(true);
    expect(isUnsubscribeToken(SECRET, { ...OPS, alertId: 'ea_2' }, token)).toBe(
      false,
    );
    expect(
      isUnsubscribeToken(SECRET, { ...OPS, email: 'team@example.com' }, token),
    ).toBe(false);
    expect(isUnsubscribeToken(SECRET, OPS, token.slice(0, 42))).toBe(false);
    expect(isUnsubscribeToken(SECRET, OPS, `${token}a`)).toBe(false);
    expect(isUnsubscribeToken(SECRET, OPS, '')).toBe(false);
  });
});

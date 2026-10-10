import { isUnsubscribeToken, unsubscribeToken } from './unsubscribe-token';

const SECRET = 'a'.repeat(32);

describe('unsubscribe token', () => {
  it('is the same for the same alert and secret', () => {
    expect(unsubscribeToken(SECRET, 'ea_1')).toBe(
      unsubscribeToken(SECRET, 'ea_1'),
    );
  });

  it('differs per alert and per secret', () => {
    expect(unsubscribeToken(SECRET, 'ea_1')).not.toBe(
      unsubscribeToken(SECRET, 'ea_2'),
    );
    expect(unsubscribeToken(SECRET, 'ea_1')).not.toBe(
      unsubscribeToken('b'.repeat(32), 'ea_1'),
    );
  });

  it('is 43 characters of base64url', () => {
    expect(unsubscribeToken(SECRET, 'ea_1')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('accepts only the token minted for that alert', () => {
    const token = unsubscribeToken(SECRET, 'ea_1');
    expect(isUnsubscribeToken(SECRET, 'ea_1', token)).toBe(true);
    expect(isUnsubscribeToken(SECRET, 'ea_2', token)).toBe(false);
    expect(isUnsubscribeToken(SECRET, 'ea_1', token.slice(0, 42))).toBe(false);
    expect(isUnsubscribeToken(SECRET, 'ea_1', `${token}a`)).toBe(false);
    expect(isUnsubscribeToken(SECRET, 'ea_1', '')).toBe(false);
  });
});

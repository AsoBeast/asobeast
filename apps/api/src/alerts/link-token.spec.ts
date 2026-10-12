import { isLinkToken, LINK_TOKEN_PATTERN, linkToken } from './link-token';

const SECRET = 'a'.repeat(32);

describe('link token', () => {
  it('is 43 characters of base64url', () => {
    expect(linkToken(SECRET, 'purpose', ['a', 'b'])).toMatch(
      LINK_TOKEN_PATTERN,
    );
  });

  it('differs per purpose, per part and per secret', () => {
    const token = linkToken(SECRET, 'purpose', ['a', 'b']);
    expect(linkToken(SECRET, 'other', ['a', 'b'])).not.toBe(token);
    expect(linkToken(SECRET, 'purpose', ['a', 'c'])).not.toBe(token);
    expect(linkToken('b'.repeat(32), 'purpose', ['a', 'b'])).not.toBe(token);
  });

  it('accepts only the token minted for the same purpose and parts', () => {
    const token = linkToken(SECRET, 'purpose', ['a', 'b']);
    expect(isLinkToken(SECRET, 'purpose', ['a', 'b'], token)).toBe(true);
    expect(isLinkToken(SECRET, 'other', ['a', 'b'], token)).toBe(false);
    expect(isLinkToken(SECRET, 'purpose', ['a', 'c'], token)).toBe(false);
    expect(isLinkToken(SECRET, 'purpose', ['a', 'b'], token.slice(1))).toBe(
      false,
    );
  });
});

import { sessionClaimsOf } from './session-claims';

describe('sessionClaimsOf', () => {
  it('reads the user, the session version and the session id', () => {
    expect(
      sessionClaimsOf({ sub: 'u1', sv: 3, jti: 'abc', iat: 1, exp: 2 }),
    ).toEqual({ sub: 'u1', sv: 3, jti: 'abc' });
  });

  it('refuses a cookie issued before sessions had an id', () => {
    expect(sessionClaimsOf({ sub: 'u1', sv: 0, iat: 1, exp: 2 })).toBeNull();
  });

  it.each([
    ['an empty session id', { sub: 'u1', sv: 0, jti: '' }],
    ['a numeric session id', { sub: 'u1', sv: 0, jti: 7 }],
    ['a missing user', { sv: 0, jti: 'abc' }],
    ['a fractional version', { sub: 'u1', sv: 0.5, jti: 'abc' }],
    ['a textual version', { sub: 'u1', sv: '0', jti: 'abc' }],
  ])('refuses %s', (_name, payload) => {
    expect(sessionClaimsOf(payload)).toBeNull();
  });

  it.each([null, undefined, 'token', 7])(
    'refuses a payload of %p',
    (payload) => {
      expect(sessionClaimsOf(payload)).toBeNull();
    },
  );
});

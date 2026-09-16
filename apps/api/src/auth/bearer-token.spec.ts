import { bearerToken } from './bearer-token';

describe('bearerToken', () => {
  it.each([
    ['Bearer asob_abc', 'asob_abc'],
    ['Bearer   asob_abc  ', 'asob_abc'],
  ])('reads the token from %j', (authorization, token) => {
    expect(bearerToken(authorization)).toBe(token);
  });

  it.each([['asob_abc'], ['Basic asob_abc'], ['Bearer '], [undefined]])(
    'finds no token in %j',
    (authorization) => {
      expect(bearerToken(authorization)).toBeNull();
    },
  );
});

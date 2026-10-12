import { apiToken, bearerToken } from './bearer-token';

describe('bearerToken', () => {
  it.each([
    ['Bearer asob_abc', 'asob_abc'],
    ['Bearer   asob_abc  ', 'asob_abc'],
    ['bearer asob_abc', 'asob_abc'],
    ['BEARER asob_abc', 'asob_abc'],
  ])('reads the token from %j', (authorization, token) => {
    expect(bearerToken(authorization)).toBe(token);
  });

  it.each([
    ['asob_abc'],
    ['Basic asob_abc'],
    ['Bearer '],
    ['Bearer asob_abc extra'],
    [undefined],
  ])('finds no token in %j', (authorization) => {
    expect(bearerToken(authorization)).toBeNull();
  });
});

describe('apiToken', () => {
  it('reads a bearer token that carries the api token prefix', () => {
    expect(apiToken('Bearer asob_abc')).toBe('asob_abc');
  });

  it.each([['Bearer not-an-api-token'], ['Basic asob_abc'], [undefined]])(
    'finds no api token in %j',
    (authorization) => {
      expect(apiToken(authorization)).toBeNull();
    },
  );
});

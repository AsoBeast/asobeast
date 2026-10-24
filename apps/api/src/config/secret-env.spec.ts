import { SECRET_ENV_KEYS, secretLiteralsFrom } from './secret-env';

describe('SECRET_ENV_KEYS', () => {
  it.each([
    'STORE_CONNECT_ENCRYPTION_KEY',
    'STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS',
    'GOOGLE_PLAY_OAUTH_CLIENT_SECRET',
  ])('scrubs %s from logs', (name) => {
    expect(SECRET_ENV_KEYS).toContain(name);
  });

  it('reads only the values that are set', () => {
    const values: Record<string, string | undefined> = {
      STORE_CONNECT_ENCRYPTION_KEY: 'current-key-value',
      STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS: undefined,
    };

    expect(secretLiteralsFrom((key) => values[key])).toEqual([
      'current-key-value',
    ]);
  });
});

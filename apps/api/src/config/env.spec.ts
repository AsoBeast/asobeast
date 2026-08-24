import { validateEnv } from './env';

describe('validateEnv', () => {
  it.each(['true', 'false', true, false])(
    'rejects the removed AUTH_ENABLED value %p',
    (value) => {
      expect(() =>
        validateEnv({ AUTH_ENABLED: value, AUTH_SECRET: 'a'.repeat(32) }),
      ).toThrow('AUTH_ENABLED is no longer supported');
    },
  );

  it('requires AUTH_SECRET', () => {
    expect(() => validateEnv({})).toThrow();
  });

  it('rejects a 31 character AUTH_SECRET', () => {
    expect(() => validateEnv({ AUTH_SECRET: 'a'.repeat(31) })).toThrow(
      'AUTH_SECRET must be at least 32 characters',
    );
  });

  it('accepts a 32 character AUTH_SECRET', () => {
    expect(
      validateEnv({ AUTH_SECRET: 'a'.repeat(32) }).AUTH_SECRET,
    ).toHaveLength(32);
  });
});

describe('NODE_ENV', () => {
  it('defaults to development', () => {
    expect(validateEnv({ AUTH_SECRET: 'a'.repeat(32) }).NODE_ENV).toBe(
      'development',
    );
  });

  it.each(['development', 'test'])('accepts %s', (value) => {
    expect(
      validateEnv({ AUTH_SECRET: 'a'.repeat(32), NODE_ENV: value }).NODE_ENV,
    ).toBe(value);
  });

  it('accepts production alongside a safe production configuration', () => {
    expect(
      validateEnv({
        AUTH_SECRET: 'a'.repeat(32),
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'true',
      }).NODE_ENV,
    ).toBe('production');
  });

  it('rejects an unknown environment', () => {
    expect(() =>
      validateEnv({ AUTH_SECRET: 'a'.repeat(32), NODE_ENV: 'staging' }),
    ).toThrow();
  });
});

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

describe('AI_CALLS_PER_MONTH', () => {
  const withCap = (value: string) =>
    validateEnv({ AUTH_SECRET: 'a'.repeat(32), AI_CALLS_PER_MONTH: value });

  it('leaves ai calls unlimited when AI_CALLS_PER_MONTH is blank', () => {
    expect(withCap('  ').AI_CALLS_PER_MONTH).toBeNull();
  });

  it('leaves ai calls unlimited when AI_CALLS_PER_MONTH is unset', () => {
    expect(
      validateEnv({ AUTH_SECRET: 'a'.repeat(32) }).AI_CALLS_PER_MONTH,
    ).toBeNull();
  });

  it('reads a whole number of ai calls', () => {
    expect(withCap('50').AI_CALLS_PER_MONTH).toBe(50);
    expect(withCap('0').AI_CALLS_PER_MONTH).toBe(0);
  });

  it('reads a numeric cap rather than treating it as unlimited', () => {
    expect(
      validateEnv({ AUTH_SECRET: 'a'.repeat(32), AI_CALLS_PER_MONTH: 5 })
        .AI_CALLS_PER_MONTH,
    ).toBe(5);
  });

  it.each(['-1', 'abc', '2.5'])('refuses an ai call cap of %s', (value) => {
    expect(() => withCap(value)).toThrow();
  });
});

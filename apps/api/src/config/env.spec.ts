import { DEFAULT_OCR_LANGUAGES } from '../screenshots/ocr-languages';
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

describe('the screenshot ocr variables', () => {
  const secret = { AUTH_SECRET: 'a'.repeat(32) };

  it('reads on by default with every bundled language', () => {
    const env = validateEnv(secret);

    expect(env.SCREENSHOT_OCR).toBe(true);
    expect(env.SCREENSHOT_OCR_LANGUAGES).toEqual(DEFAULT_OCR_LANGUAGES);
  });

  it('switches off and narrows the languages', () => {
    const env = validateEnv({
      ...secret,
      SCREENSHOT_OCR: 'false',
      SCREENSHOT_OCR_LANGUAGES: ' eng , jpn ',
    });

    expect(env.SCREENSHOT_OCR).toBe(false);
    expect(env.SCREENSHOT_OCR_LANGUAGES).toEqual(['eng', 'jpn']);
  });

  it('reads polish by default and accepts it in a narrowed list', () => {
    expect(validateEnv(secret).SCREENSHOT_OCR_LANGUAGES).toContain('pol');
    expect(
      validateEnv({ ...secret, SCREENSHOT_OCR_LANGUAGES: 'eng,pol' })
        .SCREENSHOT_OCR_LANGUAGES,
    ).toEqual(['eng', 'pol']);
  });

  it.each(['klingon', 'eng,klingon', ',', 'eng,xx'])(
    'refuses to boot on the languages %j',
    (value) => {
      expect(() =>
        validateEnv({ ...secret, SCREENSHOT_OCR_LANGUAGES: value }),
      ).toThrow();
    },
  );
});

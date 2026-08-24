import { validateEnv } from './env';
import { productionWarnings } from './production-safety';

const BASE = { AUTH_SECRET: 'a'.repeat(32) };

const production = (overrides: Record<string, unknown> = {}) =>
  validateEnv({ ...BASE, NODE_ENV: 'production', ...overrides });

describe('production safety', () => {
  describe('registration workspace', () => {
    it('gives every self registration its own workspace by default', () => {
      expect(validateEnv(BASE).AUTH_REGISTRATION_WORKSPACE).toBe('own');
    });

    it('refuses to boot when a hosted instance shares one workspace', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          AUTH_REGISTRATION_WORKSPACE: 'shared',
        }),
      ).toThrow('AUTH_REGISTRATION_WORKSPACE must be own');
    });

    it('names what a stranger would reach so the refusal is actionable', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          AUTH_REGISTRATION_WORKSPACE: 'shared',
        }),
      ).toThrow(/read and write access/);
    });

    it('accepts the shared opt-in on a self hosted instance', () => {
      expect(
        validateEnv({ ...BASE, AUTH_REGISTRATION_WORKSPACE: 'shared' })
          .AUTH_REGISTRATION_WORKSPACE,
      ).toBe('shared');
    });
  });

  describe('session cookies', () => {
    it('refuses to boot with an insecure cookie in production', () => {
      expect(() => production({ AUTH_COOKIE_SECURE: 'false' })).toThrow(
        'AUTH_COOKIE_SECURE must be true when NODE_ENV is production',
      );
    });

    it('names the reason so an operator knows what is at risk', () => {
      expect(() => production({ AUTH_COOKIE_SECURE: 'false' })).toThrow(
        /plain HTTP/,
      );
    });

    it('boots with a secure cookie in production', () => {
      expect(
        production({ AUTH_COOKIE_SECURE: 'true' }).AUTH_COOKIE_SECURE,
      ).toBe(true);
    });

    it.each(['development', 'test'])(
      'allows an insecure cookie outside production, for %s',
      (nodeEnv) => {
        expect(
          validateEnv({
            ...BASE,
            NODE_ENV: nodeEnv,
            AUTH_COOKIE_SECURE: 'false',
          }).AUTH_COOKIE_SECURE,
        ).toBe(false);
      },
    );
  });

  describe('proxy trust', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({ AUTH_COOKIE_SECURE: 'true', ...overrides }),
      );

    it('warns rather than refuses when no proxy hop is trusted in production', () => {
      expect(() =>
        production({ AUTH_COOKIE_SECURE: 'true', TRUST_PROXY: 'false' }),
      ).not.toThrow();
      expect(warningsFor({ TRUST_PROXY: 'false' }).join(' ')).toContain(
        'TRUST_PROXY is 0 in production',
      );
    });

    it('explains that every client shares one throttling bucket', () => {
      expect(warningsFor({ TRUST_PROXY: 'false' }).join(' ')).toContain(
        'every client shares one bucket',
      );
    });

    it('warns about the spoofing risk of counting an untrusted hop', () => {
      expect(warningsFor({ TRUST_PROXY: 'false' }).join(' ')).toContain(
        'spoof X-Forwarded-For',
      );
    });

    it('stays quiet once at least one hop is trusted', () => {
      expect(warningsFor({ TRUST_PROXY: 'true' })).toEqual([]);
      expect(warningsFor({ TRUST_PROXY: '2' })).toEqual([]);
    });

    it('stays quiet outside production', () => {
      expect(
        productionWarnings(
          validateEnv({
            ...BASE,
            NODE_ENV: 'development',
            TRUST_PROXY: 'false',
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('billing', () => {
    it('refuses a trial length that locks out every new account', () => {
      expect(() =>
        production({
          AUTH_COOKIE_SECURE: 'true',
          BILLING_ENABLED: 'true',
          TRIAL_DAYS: '0',
        }),
      ).toThrow('TRIAL_DAYS must be at least 1 when BILLING_ENABLED is true');
    });

    it('accepts a trial of one day', () => {
      expect(() =>
        production({
          AUTH_COOKIE_SECURE: 'true',
          BILLING_ENABLED: 'true',
          TRIAL_DAYS: '1',
        }),
      ).not.toThrow();
    });

    it('ignores the trial length when billing is disabled', () => {
      expect(() =>
        production({
          AUTH_COOKIE_SECURE: 'true',
          BILLING_ENABLED: 'false',
          TRIAL_DAYS: '0',
        }),
      ).not.toThrow();
    });

    it('refuses the combination outside production too', () => {
      expect(() =>
        validateEnv({ ...BASE, BILLING_ENABLED: 'true', TRIAL_DAYS: '0' }),
      ).toThrow('TRIAL_DAYS must be at least 1');
    });

    it('refuses mandatory confirmation with no host to send people to', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'asobeast <alerts@example.com>',
        }),
      ).toThrow('WEB_PUBLIC_URL must be set when BILLING_ENABLED is true');
    });

    it('accepts mandatory confirmation once the host is known', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'asobeast <alerts@example.com>',
          WEB_PUBLIC_URL: 'https://app.example.com',
        }),
      ).not.toThrow();
    });

    it('leaves an instance with no smtp alone', () => {
      expect(() =>
        validateEnv({ ...BASE, BILLING_ENABLED: 'true' }),
      ).not.toThrow();
    });
  });

  describe('webhook targets', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({ AUTH_COOKIE_SECURE: 'true', ...overrides }),
      );

    it('refuses private webhook targets on a hosted instance', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true',
        }),
      ).toThrow('WEBHOOK_ALLOW_PRIVATE_TARGETS must be false');
    });

    it('names what a customer could reach', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          BILLING_ENABLED: 'true',
          WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true',
        }),
      ).toThrow(/metadata service/);
    });

    it('refuses the combination outside production too', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          NODE_ENV: 'development',
          BILLING_ENABLED: 'true',
          WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true',
        }),
      ).toThrow('WEBHOOK_ALLOW_PRIVATE_TARGETS must be false');
    });

    it('warns when a self-hosted instance opts in to private targets', () => {
      expect(
        warningsFor({ WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' }).join(' '),
      ).toContain('WEBHOOK_ALLOW_PRIVATE_TARGETS is true in production');
    });

    it('stays quiet on the secure default', () => {
      expect(warningsFor({}).join(' ')).not.toContain(
        'WEBHOOK_ALLOW_PRIVATE_TARGETS',
      );
    });
  });

  describe('alert delivery', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({
          AUTH_COOKIE_SECURE: 'true',
          TRUST_PROXY: 'true',
          ...overrides,
        }),
      );

    it('warns when instant delivery has no configured channel', () => {
      expect(warningsFor({ ALERT_DELIVERY: 'instant' }).join(' ')).toContain(
        'ALERT_DELIVERY is instant',
      );
    });

    it('stays quiet when smtp is configured', () => {
      expect(
        warningsFor({
          ALERT_DELIVERY: 'instant',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'alerts@example.com',
        }),
      ).toEqual([]);
    });

    it('stays quiet for batched delivery', () => {
      expect(warningsFor({ ALERT_DELIVERY: 'batched' })).toEqual([]);
    });
  });

  describe('smtp transport', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({
          AUTH_COOKIE_SECURE: 'true',
          TRUST_PROXY: 'true',
          ...overrides,
        }),
      );

    it('warns when implicit tls is paired with the submission port', () => {
      expect(
        warningsFor({
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'alerts@example.com',
          SMTP_SECURE: 'true',
          SMTP_PORT: '587',
        }).join(' '),
      ).toContain('SMTP_SECURE is true with SMTP_PORT 587');
    });

    it('stays quiet on the implicit tls port', () => {
      expect(
        warningsFor({
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'alerts@example.com',
          SMTP_SECURE: 'true',
          SMTP_PORT: '465',
        }),
      ).toEqual([]);
    });
  });

  describe('open registration', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({
          AUTH_COOKIE_SECURE: 'true',
          TRUST_PROXY: 'true',
          ...overrides,
        }),
      );

    it('warns that open registration exposes the shared workspace', () => {
      const warning = warningsFor({
        AUTH_ALLOW_REGISTRATION: 'true',
        AUTH_REGISTRATION_WORKSPACE: 'shared',
        BILLING_ENABLED: 'false',
      }).join(' ');
      expect(warning).toContain('AUTH_ALLOW_REGISTRATION is true');
      expect(warning).toContain('bootstrap workspace');
    });

    it('stays quiet when open registration keeps workspaces apart', () => {
      expect(warningsFor({ AUTH_ALLOW_REGISTRATION: 'true' })).toEqual([]);
    });

    it('stays quiet when registration is closed', () => {
      expect(
        warningsFor({
          AUTH_ALLOW_REGISTRATION: 'false',
          AUTH_REGISTRATION_WORKSPACE: 'shared',
        }),
      ).toEqual([]);
    });

    it('stays quiet when every registration gets its own workspace', () => {
      expect(
        warningsFor({
          AUTH_ALLOW_REGISTRATION: 'true',
          BILLING_ENABLED: 'true',
          STRIPE_SECRET_KEY: 'sk_live_key',
          STRIPE_WEBHOOK_SECRET: 'whsec_key',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'asobeast <alerts@example.com>',
          WEB_PUBLIC_URL: 'https://app.example.com',
        }),
      ).toEqual([]);
    });
  });

  describe('billing configuration', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({
          AUTH_COOKIE_SECURE: 'true',
          TRUST_PROXY: 'true',
          ...overrides,
        }),
      );

    it('warns when billing is on with no way to take payment', () => {
      expect(warningsFor({ BILLING_ENABLED: 'true' }).join(' ')).toContain(
        'no STRIPE_SECRET_KEY',
      );
    });

    it('warns when Stripe cannot verify a webhook delivery', () => {
      expect(
        warningsFor({
          BILLING_ENABLED: 'true',
          STRIPE_SECRET_KEY: 'sk_live_key',
        }).join(' '),
      ).toContain('no STRIPE_WEBHOOK_SECRET');
    });

    it('warns when Stripe has nowhere to return the customer to', () => {
      expect(
        warningsFor({
          BILLING_ENABLED: 'true',
          STRIPE_SECRET_KEY: 'sk_live_key',
          STRIPE_WEBHOOK_SECRET: 'whsec_key',
        }).join(' '),
      ).toContain('no WEB_PUBLIC_URL');
    });

    it('stays quiet once Stripe is configured end to end', () => {
      expect(
        warningsFor({
          BILLING_ENABLED: 'true',
          STRIPE_SECRET_KEY: 'sk_live_key',
          STRIPE_WEBHOOK_SECRET: 'whsec_key',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'asobeast <alerts@example.com>',
          WEB_PUBLIC_URL: 'https://app.example.com',
        }),
      ).toEqual([]);
    });

    it('stays quiet on a self hosted instance with no billing at all', () => {
      expect(warningsFor({})).toEqual([]);
    });
  });

  describe('the anonymous documentation surface', () => {
    const warningsFor = (overrides: Record<string, unknown>): string[] =>
      productionWarnings(
        production({
          AUTH_COOKIE_SECURE: 'true',
          TRUST_PROXY: 'true',
          ...overrides,
        }),
      );

    it('warns when the openapi surface is public in production', () => {
      expect(warningsFor({ API_DOCS: 'public' }).join(' ')).toContain(
        'API_DOCS is public',
      );
    });

    it.each(['owner', 'off'])('stays quiet for %s', (mode) => {
      expect(warningsFor({ API_DOCS: mode })).toEqual([]);
    });
  });
});

describe('a metered instance with no mail path', () => {
  const warningsFor = (overrides: Record<string, unknown> = {}) =>
    productionWarnings(
      validateEnv({
        AUTH_SECRET: 'a'.repeat(32),
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'true',
        ...overrides,
      }),
    ).join(' ');

  const metered = (overrides: Record<string, unknown> = {}) =>
    warningsFor({ BILLING_ENABLED: 'true', TRIAL_DAYS: '7', ...overrides });

  it('warns when billing is on and no mail transport is configured', () => {
    expect(metered()).toContain('BILLING_ENABLED is true in production');
    expect(metered()).toContain('SMTP_HOST');
  });

  it('names what will not happen rather than only the missing variable', () => {
    const warning = metered();

    expect(warning).toContain('confirm');
    expect(warning).toContain('trial');
    expect(warning).toContain('recover');
  });

  it('warns just as loudly on half a mail configuration', () => {
    expect(metered({ SMTP_HOST: 'smtp.example.com' })).toContain('SMTP_FROM');
    expect(metered({ SMTP_FROM: 'asobeast <a@b.c>' })).toContain('SMTP_HOST');
  });

  it('stays quiet once both halves are set', () => {
    expect(
      metered({
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'asobeast <a@b.c>',
        WEB_PUBLIC_URL: 'https://app.example.com',
      }),
    ).not.toContain('no way to send');
  });

  it('leaves a self hosted instance alone, where email is genuinely optional', () => {
    expect(warningsFor({ BILLING_ENABLED: 'false' })).not.toContain(
      'no way to send',
    );
  });

  it('says nothing outside production, as every other warning does', () => {
    expect(
      productionWarnings(
        validateEnv({
          AUTH_SECRET: 'a'.repeat(32),
          BILLING_ENABLED: 'true',
          TRIAL_DAYS: '7',
        }),
      ),
    ).toEqual([]);
  });
});

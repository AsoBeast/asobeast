import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateEnv } from '../src/config/env';

const SAFE: Record<string, string> = {
  AUTH_SECRET: 'a'.repeat(32),
  NODE_ENV: 'production',
  AUTH_COOKIE_SECURE: 'true',
  TRUST_PROXY: 'true',
};

const MANAGED_KEYS = [
  'AUTH_SECRET',
  'NODE_ENV',
  'AUTH_COOKIE_SECURE',
  'TRUST_PROXY',
  'BILLING_ENABLED',
  'TRIAL_DAYS',
  'AUTH_ENABLED',
  'WEB_PUBLIC_URL',
  'SMTP_HOST',
  'SMTP_FROM',
];

const compileWith = async (env: Record<string, string>) => {
  const saved = new Map(MANAGED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
      ],
    }).compile();
  } finally {
    for (const key of MANAGED_KEYS) delete process.env[key];
    for (const [key, value] of saved) {
      if (value !== undefined) process.env[key] = value;
    }
  }
};

describe('Configuration guards at boot (e2e)', () => {
  it('refuses to construct the application with an insecure production cookie', async () => {
    await expect(
      compileWith({ ...SAFE, AUTH_COOKIE_SECURE: 'false' }),
    ).rejects.toThrow(
      'AUTH_COOKIE_SECURE must be true when NODE_ENV is production',
    );
  });

  it('refuses to construct the application with an unparseable proxy hop count', async () => {
    await expect(compileWith({ ...SAFE, TRUST_PROXY: 'yes' })).rejects.toThrow(
      'TRUST_PROXY must be a hop count',
    );
  });

  it('refuses to construct the application with a zero day trial', async () => {
    await expect(
      compileWith({ ...SAFE, BILLING_ENABLED: 'true', TRIAL_DAYS: '0' }),
    ).rejects.toThrow(
      'TRIAL_DAYS must be at least 1 when BILLING_ENABLED is true',
    );
  });

  it('still refuses the removed AUTH_ENABLED variable', async () => {
    await expect(
      compileWith({ ...SAFE, AUTH_ENABLED: 'true' }),
    ).rejects.toThrow('AUTH_ENABLED is no longer supported');
  });

  it.each([
    'mailto:ops@example.com',
    'file:///srv/asobeast',
    'javascript:alert(1)',
    'aso.example.com',
  ])(
    'refuses to construct the application with WEB_PUBLIC_URL=%s',
    async (url) => {
      await expect(
        compileWith({ ...SAFE, WEB_PUBLIC_URL: url }),
      ).rejects.toThrow('WEB_PUBLIC_URL must be the http or https origin');
    },
  );

  it('accepts the http and https origins a deployment is served from', async () => {
    for (const url of ['https://aso.example.com', 'http://localhost:3001']) {
      const moduleRef = await compileWith({ ...SAFE, WEB_PUBLIC_URL: url });
      expect(moduleRef).toBeDefined();
      await moduleRef.close();
    }
  });

  it('constructs the application with a safe production configuration', async () => {
    const moduleRef = await compileWith(SAFE);
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  describe('a metered instance with no mail path', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const bootWith = async (env: Record<string, string>): Promise<string> => {
      warn.mockClear();
      const moduleRef = await compileWith({
        ...SAFE,
        BILLING_ENABLED: 'true',
        TRIAL_DAYS: '7',
        ...env,
      });
      await moduleRef.close();
      return warn.mock.calls.flat().join(' ');
    };

    afterAll(() => {
      warn.mockRestore();
    });

    it('boots, and says out loud that it can send no account email', async () => {
      const logged = await bootWith({});

      expect(logged).toContain('BILLING_ENABLED is true in production');
      expect(logged).toContain('confirm');
      expect(logged).toContain('recover');
    });

    it('warns just as loudly on half a mail configuration', async () => {
      expect(await bootWith({ SMTP_HOST: 'smtp.example.com' })).toContain(
        'SMTP_FROM is empty',
      );
    });

    it('says nothing once the mail path is configured', async () => {
      const logged = await bootWith({
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'asobeast <alerts@example.com>',
        WEB_PUBLIC_URL: 'https://app.example.com',
      });

      expect(logged).not.toContain('cannot send a single account email');
    });
  });
});

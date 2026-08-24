import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../alerts/mailer.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';
import { PublicWebUrl } from './public-web-url';
import { RecoveryRateLimiter } from './rate-limit/recovery-rate.limiter';
import { RecoveryMailer } from './recovery-mailer';

const sendMail = jest.fn<Promise<void>, [unknown]>();
const verify = jest.fn<Promise<boolean>, []>();

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: (options: unknown): Promise<void> => sendMail(options),
    verify: (): Promise<boolean> => verify(),
  }),
}));

const RELAY_PASSWORD = 'hunter2';
const NOW = new Date('2026-08-20T10:00:00.000Z');
const ACCOUNT = { id: 'usr_1', email: 'owner@example.com' };

const ENV = {
  SMTP_HOST: 'relay.example.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: 'api',
  SMTP_PASSWORD: RELAY_PASSWORD,
  SMTP_FROM: 'asobeast <alerts@example.test>',
  WEB_PUBLIC_URL: 'https://app.example.test',
};

describe('Recovery when the relay quotes the configured password back', () => {
  const config = {
    get: (key: keyof Env) => ENV[key as keyof typeof ENV],
  } as unknown as ConfigService<Env, true>;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(ACCOUNT),
      update: jest.fn().mockResolvedValue(ACCOUNT),
    },
    alertDelivery: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;

  const build = (): PasswordResetService => {
    const mailer = new MailerService(config, prisma, crossTenant);
    return new PasswordResetService(
      prisma,
      crossTenant,
      new RecoveryMailer(mailer, new PublicWebUrl(config)),
      { claim: () => Promise.resolve(true) } as unknown as RecoveryRateLimiter,
    );
  };

  const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 10));

  beforeEach(() => {
    sendMail.mockReset();
    verify.mockReset().mockResolvedValue(true);
  });

  it('never writes the relay password into the application log', async () => {
    sendMail.mockRejectedValue(
      new Error(`535 authentication failed for ${RELAY_PASSWORD}`),
    );
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await build().request(ACCOUNT.email, NOW);
    await settle();

    const lines = logged.mock.calls.flat().join(' ');
    expect(lines).toContain('could not send the recovery email');
    expect(lines).not.toContain(RELAY_PASSWORD);
    logged.mockRestore();
  });

  it('never writes the relay password into the log when the relay refuses to connect', async () => {
    verify.mockRejectedValue(
      new Error(`connect refused for api:${RELAY_PASSWORD}`),
    );
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await build().request(ACCOUNT.email, NOW);
    await settle();

    expect(logged.mock.calls.flat().join(' ')).not.toContain(RELAY_PASSWORD);
    logged.mockRestore();
  });
});

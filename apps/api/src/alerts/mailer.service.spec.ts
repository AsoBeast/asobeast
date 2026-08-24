import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';

const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn(() => ({ sendMail, verify }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

type Values = Partial<Record<keyof Env, unknown>>;

const buildConfig = (values: Values): ConfigService<Env, true> =>
  ({
    get: jest.fn((key: keyof Env) => values[key]),
  }) as unknown as ConfigService<Env, true>;

describe('MailerService', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue(undefined);
    verify.mockReset().mockResolvedValue(true);
    createTransport.mockClear();
  });

  it('is disabled without SMTP_HOST and SMTP_FROM', () => {
    const mailer = new MailerService(buildConfig({}));
    expect(mailer.enabled).toBe(false);
  });

  it('is enabled once host and from are set', () => {
    const mailer = new MailerService(
      buildConfig({ SMTP_HOST: 'localhost', SMTP_FROM: 'a@b.c' }),
    );
    expect(mailer.enabled).toBe(true);
  });

  it('throws a descriptive error when disabled', async () => {
    const mailer = new MailerService(buildConfig({ SMTP_HOST: 'localhost' }));
    await expect(
      mailer.send('to@x.c', 'Hi', 'body', '<p>body</p>'),
    ).rejects.toThrow('Email alerts require SMTP configuration');
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('sends through a lazily created singleton transport', async () => {
    const mailer = new MailerService(
      buildConfig({
        SMTP_HOST: 'localhost',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pass',
        SMTP_FROM: 'alerts@x.c',
      }),
    );

    await mailer.send('to@x.c', 'Subject', 'text', '<p>text</p>');
    await mailer.send('to2@x.c', 'Subject2', 'text2', '<p>text2</p>');

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'alerts@x.c',
      to: 'to@x.c',
      subject: 'Subject',
      text: 'text',
      html: '<p>text</p>',
    });
  });

  it('propagates transport errors so callers can retry', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    const mailer = new MailerService(
      buildConfig({ SMTP_HOST: 'localhost', SMTP_FROM: 'alerts@x.c' }),
    );
    await expect(mailer.send('to@x.c', 's', 't', '<p>t</p>')).rejects.toThrow(
      'smtp down',
    );
  });
});

describe('MailerService recording an account email', () => {
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const prisma = {
    alertDelivery: { create },
  } as unknown as PrismaService;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const CONFIGURED = {
    SMTP_HOST: 'localhost',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'relay-user',
    SMTP_PASSWORD: 'relay-password-value',
    SMTP_FROM: 'asobeast <alerts@x.c>',
  };

  const build = (values: Values = CONFIGURED): MailerService =>
    new MailerService(buildConfig(values), prisma, crossTenant);

  const mail = (secrets: readonly string[] = []) => ({
    kind: 'recovery' as const,
    to: 'owner@example.com',
    subject: 'Reset your asobeast password',
    text: 'Choose a new password: https://app.example.com/reset-password?token=abc',
    html: '<p>Choose a new password.</p>',
    secrets,
  });

  const recorded = () => create.mock.calls[0][0].data;

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue(undefined);
    verify.mockReset().mockResolvedValue(true);
    createTransport.mockClear();
    create.mockReset().mockResolvedValue({});
  });

  it('records a delivered account email', async () => {
    await build().sendAccountMail(mail());

    expect(recorded()).toMatchObject({
      channel: 'account',
      event: 'recovery',
      status: 'delivered',
      detail: null,
    });
  });

  it('records a failure and still lets the caller learn it failed', async () => {
    sendMail.mockRejectedValue(new Error('550 relay refused the sender'));

    await expect(build().sendAccountMail(mail())).rejects.toThrow(
      '550 relay refused the sender',
    );
    expect(recorded()).toMatchObject({
      channel: 'account',
      event: 'recovery',
      status: 'failed',
      detail: '550 relay refused the sender',
    });
  });

  it('records a message it never attempted as skipped, not as failed', async () => {
    await expect(build({}).sendAccountMail(mail())).rejects.toThrow(
      'Email alerts require SMTP configuration',
    );

    expect(recorded()).toMatchObject({ status: 'skipped' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('never records a relay password too short for the generic scrubber', async () => {
    sendMail.mockRejectedValue(
      new Error('535 authentication failed for hunter2'),
    );

    await expect(
      build({ ...CONFIGURED, SMTP_PASSWORD: 'hunter2' }).sendAccountMail(
        mail(),
      ),
    ).rejects.toThrow();
    expect(String(recorded().detail)).not.toContain('hunter2');
  });

  it('never records the relay password', async () => {
    sendMail.mockRejectedValue(
      new Error('535 authentication failed for relay-password-value'),
    );

    await expect(build().sendAccountMail(mail())).rejects.toThrow();
    expect(String(recorded().detail)).not.toContain('relay-password-value');
  });

  it('never records a token the message carried', async () => {
    const token = 'a'.repeat(48);
    sendMail.mockRejectedValue(
      new Error(`550 rejected body carrying ${token}`),
    );

    await expect(build().sendAccountMail(mail([token]))).rejects.toThrow();
    expect(String(recorded().detail)).not.toContain(token);
  });

  it('never lets a relay password too short for the generic scrubber reach the caller', async () => {
    sendMail.mockRejectedValue(
      new Error('535 authentication failed for hunter2'),
    );

    const failure = await build({ ...CONFIGURED, SMTP_PASSWORD: 'hunter2' })
      .sendAccountMail(mail())
      .catch((error: Error) => error);

    expect(failure.message).not.toContain('hunter2');
    expect(failure.message).toContain('[redacted]');
  });

  it('never lets the token the message carried reach the caller', async () => {
    const token = 'a'.repeat(48);
    sendMail.mockRejectedValue(
      new Error(`550 rejected body carrying ${token}`),
    );

    const failure = await build()
      .sendAccountMail(mail([token]))
      .catch((error: Error) => error);

    expect(failure.message).not.toContain(token);
  });

  it('still answers a relay that would not connect as unavailable', async () => {
    verify.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const failure = await build()
      .sendAccountMail(mail())
      .catch((error: Error) => error);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
  });

  it('never lets a failed recording hide the delivery failure', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    create.mockRejectedValue(new Error('the delivery log is unavailable'));

    await expect(build().sendAccountMail(mail())).rejects.toThrow('smtp down');
  });
});

describe('MailerService verifying the transport', () => {
  const CONFIGURED = {
    SMTP_HOST: 'relay.example.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_FROM: 'asobeast <alerts@x.c>',
  };

  const build = (): MailerService =>
    new MailerService(
      buildConfig(CONFIGURED),
      { alertDelivery: { create: jest.fn() } } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: (
          _justification: string,
          work: () => Promise<unknown>,
        ) => work(),
      } as unknown as CrossTenantAccess,
    );

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue(undefined);
    verify.mockReset().mockResolvedValue(true);
    createTransport.mockClear();
  });

  it('verifies the relay before the first message leaves', async () => {
    await build().send('to@x.c', 's', 't', '<p>t</p>');

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.invocationCallOrder[0]).toBeLessThan(
      sendMail.mock.invocationCallOrder[0],
    );
  });

  it('verifies once and reuses the answer for later messages', async () => {
    const mailer = build();

    await mailer.send('to@x.c', 's', 't', '<p>t</p>');
    await mailer.send('to2@x.c', 's', 't', '<p>t</p>');

    expect(verify).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('refuses to send and names the relay response when verification fails', async () => {
    verify.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:587'));

    await expect(build().send('to@x.c', 's', 't', '<p>t</p>')).rejects.toThrow(
      /relay.example.com:587.*ECONNREFUSED/s,
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('verifies again after a failure, so a relay that comes back is used', async () => {
    const mailer = build();
    verify.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expect(mailer.send('to@x.c', 's', 't', '<p>t</p>')).rejects.toThrow();
    await mailer.send('to@x.c', 's', 't', '<p>t</p>');

    expect(verify).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('never opens a connection when no transport is configured', async () => {
    const mailer = new MailerService(
      buildConfig({}),
      { alertDelivery: { create: jest.fn() } } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: (
          _justification: string,
          work: () => Promise<unknown>,
        ) => work(),
      } as unknown as CrossTenantAccess,
    );

    await expect(mailer.send('to@x.c', 's', 't', '<p>t</p>')).rejects.toThrow(
      'Email alerts require SMTP configuration',
    );
    expect(createTransport).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });
});

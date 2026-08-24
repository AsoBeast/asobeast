import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../alerts/mailer.service';
import { Env } from '../config/env';
import { PublicWebUrl } from './public-web-url';
import { RecoveryMailer } from './recovery-mailer';

const build = (origin?: string): PublicWebUrl =>
  new PublicWebUrl({
    get: () => origin,
  } as unknown as ConfigService<Env, true>);

describe('PublicWebUrl', () => {
  it('is unconfigured while no origin is set', () => {
    expect(build().configured).toBe(false);
    expect(build('').configured).toBe(false);
  });

  it('is configured once an origin is set', () => {
    expect(build('https://app.example.test').configured).toBe(true);
  });

  it('hangs a token link off the configured origin', () => {
    expect(
      build('https://app.example.test').tokenLink('/reset', 'abc', 'link'),
    ).toBe('https://app.example.test/reset?token=abc');
  });

  it('refuses to build a link that would have no host', () => {
    expect(() => build().tokenLink('/reset', 'abc', 'recovery link')).toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('RecoveryMailer readiness', () => {
  const mailer = (enabled: boolean): MailerService =>
    ({ enabled }) as unknown as MailerService;

  it('needs both a relay and a public origin', () => {
    expect(
      new RecoveryMailer(mailer(true), build('https://app.example.test'))
        .configured,
    ).toBe(true);
  });

  it('is not ready with a relay but no public origin', () => {
    expect(new RecoveryMailer(mailer(true), build()).configured).toBe(false);
  });

  it('is not ready with a public origin but no relay', () => {
    expect(
      new RecoveryMailer(mailer(false), build('https://app.example.test'))
        .configured,
    ).toBe(false);
  });
});

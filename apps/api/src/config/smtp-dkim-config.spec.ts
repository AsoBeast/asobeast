import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertSmtpDkimConfiguration,
  SMTP_DKIM_SETTINGS,
  smtpDkimEnabled,
} from './smtp-dkim-config';

const keyDirectory = mkdtempSync(join(tmpdir(), 'smtp-dkim-'));
const keyPath = join(keyDirectory, 'dkim-private.pem');
writeFileSync(keyPath, 'key');

const complete = {
  SMTP_DKIM_DOMAIN: 'mail.example.com',
  SMTP_DKIM_SELECTOR: 'asobeast',
  SMTP_DKIM_PRIVATE_KEY_PATH: keyPath,
};

const unset = {
  SMTP_DKIM_DOMAIN: undefined,
  SMTP_DKIM_SELECTOR: undefined,
  SMTP_DKIM_PRIVATE_KEY_PATH: undefined,
};

describe('smtp dkim configuration', () => {
  afterAll(() => rmSync(keyDirectory, { recursive: true, force: true }));

  it('is off when nothing is set', () => {
    expect(smtpDkimEnabled(unset)).toBe(false);
    expect(() => assertSmtpDkimConfiguration(unset)).not.toThrow();
  });

  it('is on when every setting is set and the key is readable', () => {
    expect(smtpDkimEnabled(complete)).toBe(true);
    expect(() => assertSmtpDkimConfiguration(complete)).not.toThrow();
  });

  it.each(SMTP_DKIM_SETTINGS)('refuses to boot without %s alone', (name) => {
    expect(() =>
      assertSmtpDkimConfiguration({ ...complete, [name]: undefined }),
    ).toThrow(new RegExp(`partly configured. Set ${name} or remove`));
  });

  it('names every missing setting', () => {
    expect(() =>
      assertSmtpDkimConfiguration({ ...unset, SMTP_DKIM_DOMAIN: 'd' }),
    ).toThrow('Set SMTP_DKIM_SELECTOR, SMTP_DKIM_PRIVATE_KEY_PATH or remove');
  });

  it('refuses to boot when the key cannot be read', () => {
    const missing = join(keyDirectory, 'missing.pem');
    expect(() =>
      assertSmtpDkimConfiguration({
        ...complete,
        SMTP_DKIM_PRIVATE_KEY_PATH: missing,
      }),
    ).toThrow(`cannot be read at ${missing}`);
  });
});

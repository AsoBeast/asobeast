import { resolve } from 'node:path';
import type { Env } from './env';
import { readable } from './readable-file';

export const SMTP_DKIM_SETTINGS = [
  'SMTP_DKIM_DOMAIN',
  'SMTP_DKIM_SELECTOR',
  'SMTP_DKIM_PRIVATE_KEY_PATH',
] as const;

type SmtpDkimSettings = Pick<Env, (typeof SMTP_DKIM_SETTINGS)[number]>;

export function smtpDkimEnabled(env: SmtpDkimSettings): boolean {
  return SMTP_DKIM_SETTINGS.every((name) => Boolean(env[name]));
}

export function assertSmtpDkimConfiguration(env: SmtpDkimSettings): void {
  const missing = SMTP_DKIM_SETTINGS.filter((name) => !env[name]);
  if (missing.length > 0 && missing.length < SMTP_DKIM_SETTINGS.length) {
    throw new Error(
      `DKIM signing is partly configured. Set ${missing.join(', ')} or remove every SMTP_DKIM_ variable.`,
    );
  }
  const keyPath = env.SMTP_DKIM_PRIVATE_KEY_PATH;
  if (missing.length === 0 && keyPath && !readable(keyPath)) {
    throw new Error(
      `DKIM signing is configured but SMTP_DKIM_PRIVATE_KEY_PATH cannot be read at ${resolve(keyPath)}. Put the key in apps/api/keys, where the Compose stacks mount it, or remove every SMTP_DKIM_ variable.`,
    );
  }
}

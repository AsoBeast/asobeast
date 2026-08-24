import { createHash } from 'node:crypto';
import { ActionRule, Store } from '@asobeast/shared';

export const FINGERPRINT_LENGTH = 32;
export const FINGERPRINT_SEPARATOR = '~';
export const FINGERPRINT_NULL = '-';

export interface FingerprintInput {
  rule: ActionRule;
  appId: string;
  store: Store;
  country: string;
  keywordId: string | null;
  discriminator: string | null;
}

export function normalizeDiscriminator(value: string): string {
  return value
    .replaceAll(FINGERPRINT_SEPARATOR, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function part(value: string | null): string {
  return value === null || value === '' ? FINGERPRINT_NULL : value;
}

export function actionFingerprint(input: FingerprintInput): string {
  const discriminator =
    input.discriminator === null
      ? null
      : normalizeDiscriminator(input.discriminator);

  const canonical = [
    input.rule,
    input.appId,
    input.store,
    input.country,
    part(input.keywordId),
    part(discriminator),
  ].join(FINGERPRINT_SEPARATOR);

  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);
}

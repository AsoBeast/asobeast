import { createHash, createPublicKey, type KeyObject } from 'node:crypto';

const FINGERPRINT_CHARS = 16;

const fingerprintOf = (material: Buffer | string): string =>
  createHash('sha256')
    .update(material)
    .digest('hex')
    .slice(0, FINGERPRINT_CHARS);

export function publicKeyFingerprint(privateKey: KeyObject): string {
  return fingerprintOf(
    createPublicKey(privateKey).export({ type: 'spki', format: 'der' }),
  );
}

export const secretFingerprint = (secret: string): string =>
  fingerprintOf(secret);

import { createHash, createPublicKey, type KeyObject } from 'node:crypto';

const FINGERPRINT_CHARS = 16;

export function publicKeyFingerprint(privateKey: KeyObject): string {
  const publicKey = createPublicKey(privateKey).export({
    type: 'spki',
    format: 'der',
  });
  return createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, FINGERPRINT_CHARS);
}

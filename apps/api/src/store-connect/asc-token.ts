import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from 'node:crypto';

export const ASC_AUDIENCE = 'appstoreconnect-v1';
export const ASC_TOKEN_TTL_SECONDS = 10 * 60;
export const ASC_TOKEN_REUSE_MARGIN_SECONDS = 2 * 60;
const FINGERPRINT_CHARS = 16;

export interface AscCredentials {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export class InvalidPrivateKeyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidPrivateKeyError';
  }
}

export function parsePrivateKey(pem: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPrivateKey(pem.trim());
  } catch {
    throw new InvalidPrivateKeyError(
      'The private key is not a PEM encoded PKCS8 key. Paste the whole contents of the .p8 file.',
    );
  }
  if (
    key.type !== 'private' ||
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new InvalidPrivateKeyError(
      'The private key is not an ES256 key. App Store Connect keys use the P-256 curve.',
    );
  }
  return key;
}

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function signAscToken(
  { issuerId, keyId, privateKey }: AscCredentials,
  now: Date = new Date(),
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const signingInput = [
    encode({ alg: 'ES256', kid: keyId, typ: 'JWT' }),
    encode({
      iss: issuerId,
      iat: issuedAt,
      exp: issuedAt + ASC_TOKEN_TTL_SECONDS,
      aud: ASC_AUDIENCE,
    }),
  ].join('.');
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: parsePrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function keyFingerprintOf(privateKey: string): string {
  const publicKey = createPublicKey(parsePrivateKey(privateKey)).export({
    type: 'spki',
    format: 'der',
  });
  return createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, FINGERPRINT_CHARS);
}

export class AscTokenCache {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: AscCredentials) {}

  get(now: Date = new Date()): string {
    const seconds = Math.floor(now.getTime() / 1000);
    if (
      this.token &&
      this.token.expiresAt - ASC_TOKEN_REUSE_MARGIN_SECONDS > seconds
    ) {
      return this.token.value;
    }
    this.token = {
      value: signAscToken(this.credentials, now),
      expiresAt: seconds + ASC_TOKEN_TTL_SECONDS,
    };
    return this.token.value;
  }
}

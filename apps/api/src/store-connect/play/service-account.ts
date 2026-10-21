import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

export const GOOGLE_TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token';
export const GCS_READ_ONLY_SCOPE =
  'https://www.googleapis.com/auth/devstorage.read_only';
export const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';
export const GOOGLE_ASSERTION_TTL_SECONDS = 3600;
export const GOOGLE_TOKEN_REUSE_MARGIN_SECONDS = 60;

export interface ServiceAccount {
  clientEmail: string;
  privateKeyId: string;
  privateKey: string;
}

export interface GoogleTokenAnswer {
  access_token: string;
  expires_in: number;
}

export class ServiceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceAccountError';
  }
}

const FIELDS = {
  clientEmail: 'client_email',
  privateKeyId: 'private_key_id',
  privateKey: 'private_key',
} as const;

export const SERVICE_ACCOUNT_KEY_BITS = 2048;

export function rsaKey(pem: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new ServiceAccountError(
      'The service account private_key is not a PEM encoded RSA private key.',
    );
  }
  if (
    key.asymmetricKeyType !== 'rsa' ||
    key.asymmetricKeyDetails?.modulusLength !== SERVICE_ACCOUNT_KEY_BITS
  ) {
    throw new ServiceAccountError(
      'The service account private_key is not the 2048 bit RSA key Google Cloud issues.',
    );
  }
  return key;
}

export function parseServiceAccount(json: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ServiceAccountError(
      'The service account key is not JSON. Choose the key file Google Cloud downloaded.',
    );
  }
  const record = (parsed ?? {}) as Record<string, unknown>;
  const read = (field: string): string => {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new ServiceAccountError(
        `The service account key has no ${field}. Choose the JSON key file Google Cloud downloaded.`,
      );
    }
    return value;
  };
  const account: ServiceAccount = {
    clientEmail: read(FIELDS.clientEmail),
    privateKeyId: read(FIELDS.privateKeyId),
    privateKey: read(FIELDS.privateKey),
  };
  rsaKey(account.privateKey);
  return account;
}

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function signAssertion(
  account: ServiceAccount,
  now: Date = new Date(),
  scope: string = GCS_READ_ONLY_SCOPE,
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const input = [
    encode({ alg: 'RS256', typ: 'JWT', kid: account.privateKeyId }),
    encode({
      iss: account.clientEmail,
      scope,
      aud: GOOGLE_TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: issuedAt + GOOGLE_ASSERTION_TTL_SECONDS,
    }),
  ].join('.');
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(input),
    rsaKey(account.privateKey),
  );
  return `${input}.${signature.toString('base64url')}`;
}

export class GoogleTokenCache {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly exchange: (
      assertion: string,
    ) => Promise<GoogleTokenAnswer>,
    private readonly scope: string = GCS_READ_ONLY_SCOPE,
  ) {}

  async get(now: Date = new Date()): Promise<string> {
    const seconds = Math.floor(now.getTime() / 1000);
    if (
      this.token &&
      this.token.expiresAt - GOOGLE_TOKEN_REUSE_MARGIN_SECONDS > seconds
    ) {
      return this.token.value;
    }
    const answer = await this.exchange(
      signAssertion(this.account, now, this.scope),
    );
    this.token = {
      value: answer.access_token,
      expiresAt: seconds + answer.expires_in,
    };
    return this.token.value;
  }
}

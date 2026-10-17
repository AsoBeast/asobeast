import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
export const SECRET_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';
const SEPARATOR = '.';
const ENCODING = 'base64url';
const KEY_ID_CHARS = 8;
const UNOPENABLE = 'The sealed value cannot be opened with the configured keys';

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

export function decodeSecretKey(encoded: string): Buffer {
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length !== SECRET_KEY_BYTES) {
    throw new SecretBoxError(
      `A secret box key must decode to ${SECRET_KEY_BYTES} bytes, this one decodes to ${key.length}`,
    );
  }
  return key;
}

const keyIdOf = (key: Buffer): string =>
  createHash('sha256').update(key).digest('hex').slice(0, KEY_ID_CHARS);

export class SecretBox {
  private readonly keys: Map<string, Buffer>;
  private readonly currentId: string;

  constructor(
    private readonly current: Buffer,
    previous: Buffer | null = null,
  ) {
    this.currentId = keyIdOf(current);
    this.keys = new Map([[this.currentId, current]]);
    if (previous) this.keys.set(keyIdOf(previous), previous);
  }

  seal(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.current, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(Buffer.from(context));
    const body = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      VERSION,
      this.currentId,
      iv.toString(ENCODING),
      cipher.getAuthTag().toString(ENCODING),
      body.toString(ENCODING),
    ].join(SEPARATOR);
  }

  open(sealed: string, context: string): string {
    const [version, id, iv, tag, body, ...extra] = sealed.split(SEPARATOR);
    const key = id === undefined ? undefined : this.keys.get(id);
    if (version !== VERSION || !key || !iv || !tag || !body || extra.length) {
      throw new SecretBoxError(UNOPENABLE);
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(iv, ENCODING),
        { authTagLength: TAG_BYTES },
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, ENCODING));
      return Buffer.concat([
        decipher.update(Buffer.from(body, ENCODING)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new SecretBoxError(UNOPENABLE);
    }
  }

  isCurrent(sealed: string): boolean {
    return sealed.split(SEPARATOR)[1] === this.currentId;
  }
}

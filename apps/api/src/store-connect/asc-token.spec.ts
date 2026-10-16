import {
  createPublicKey,
  generateKeyPairSync,
  verify,
  type KeyObject,
} from 'node:crypto';
import {
  ASC_AUDIENCE,
  ASC_TOKEN_TTL_SECONDS,
  AscTokenCache,
  InvalidPrivateKeyError,
  keyFingerprintOf,
  normalizePrivateKey,
  parsePrivateKey,
  signAscToken,
} from './asc-token';

const pkcs8 = (key: KeyObject): string =>
  key.export({ type: 'pkcs8', format: 'pem' }).toString();

const p256 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PEM = pkcs8(p256.privateKey);

const CREDENTIALS = {
  issuerId: '57246542-96fe-1a63-e053-0824d011072a',
  keyId: '2X9R4HXF34',
  privateKey: PEM,
};

const NOW = new Date('2026-10-07T12:00:00.000Z');

const decode = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

describe('signAscToken', () => {
  const token = signAscToken(CREDENTIALS, NOW);
  const [header, payload, signature] = token.split('.');

  it('signs a three part token whose header names the key', () => {
    expect(decode(header)).toEqual({
      alg: 'ES256',
      kid: '2X9R4HXF34',
      typ: 'JWT',
    });
  });

  it('issues ten minute tokens with the connect audience', () => {
    expect(decode(payload)).toEqual({
      iss: CREDENTIALS.issuerId,
      iat: 1_791_374_400,
      exp: 1_791_374_400 + ASC_TOKEN_TTL_SECONDS,
      aud: ASC_AUDIENCE,
    });
    expect(ASC_TOKEN_TTL_SECONDS).toBe(600);
    expect(ASC_AUDIENCE).toBe('appstoreconnect-v1');
  });

  it('signs with a raw 64 byte r and s that the public key verifies', () => {
    expect(Buffer.from(signature, 'base64url')).toHaveLength(64);
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        { key: createPublicKey(PEM), dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });

  it('fails verification once the payload changes', () => {
    const forged = Buffer.from(
      JSON.stringify({ ...decode(payload), iss: 'someone-else' }),
    ).toString('base64url');

    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${forged}`),
        { key: createPublicKey(PEM), dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(false);
  });

  it('signs a key pasted with windows line endings and padding', () => {
    const pasted = `\n  ${PEM.trim().replace(/\n/g, '\r\n')}\r\n\n`;

    expect(() =>
      signAscToken({ ...CREDENTIALS, privateKey: pasted }, NOW),
    ).not.toThrow();
  });
});

describe('normalizePrivateKey', () => {
  it('rebuilds a key pasted on one line, the way a password field sends it', () => {
    const oneLine = PEM.replace(/\r?\n/g, '');

    expect(normalizePrivateKey(oneLine)).toBe(PEM);
    expect(() =>
      signAscToken(
        { ...CREDENTIALS, privateKey: normalizePrivateKey(oneLine) },
        NOW,
      ),
    ).not.toThrow();
  });

  it('keeps a well formed key as it is', () => {
    expect(normalizePrivateKey(`\n  ${PEM}\n`)).toBe(PEM);
  });

  it('leaves text that holds no key for the parser to refuse', () => {
    expect(normalizePrivateKey(' nope ')).toBe('nope');
  });
});

describe('parsePrivateKey', () => {
  it('accepts a p-256 pkcs8 key', () => {
    expect(parsePrivateKey(PEM).asymmetricKeyType).toBe('ec');
  });

  it('refuses a key that is not PKCS8 PEM and does not echo it', () => {
    const attempt = () => parsePrivateKey('not a key at all');

    expect(attempt).toThrow(InvalidPrivateKeyError);
    expect(attempt).toThrow('Paste the whole contents of the .p8 file');
    expect(attempt).not.toThrow('not a key at all');
  });

  it('refuses a public key', () => {
    const publicPem = p256.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();

    expect(() => parsePrivateKey(publicPem)).toThrow(InvalidPrivateKeyError);
  });

  it.each([
    ['an RSA key', generateKeyPairSync('rsa', { modulusLength: 2048 })],
    ['a P-384 key', generateKeyPairSync('ec', { namedCurve: 'secp384r1' })],
  ])('refuses %s', (_, pair) => {
    expect(() => parsePrivateKey(pkcs8(pair.privateKey))).toThrow(
      'App Store Connect keys use the P-256 curve',
    );
  });
});

describe('keyFingerprintOf', () => {
  it('fingerprints the public key to sixteen hex characters', () => {
    const fingerprint = keyFingerprintOf(PEM);

    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(PEM).not.toContain(fingerprint);
  });

  it('is the same for the same key and different for another', () => {
    const other = pkcs8(
      generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey,
    );

    expect(keyFingerprintOf(PEM)).toBe(keyFingerprintOf(`\n${PEM}\n`));
    expect(keyFingerprintOf(PEM)).not.toBe(keyFingerprintOf(other));
  });
});

describe('AscTokenCache', () => {
  const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

  it('reuses a token until two minutes before it expires', () => {
    const cache = new AscTokenCache(CREDENTIALS);
    const first = cache.get(NOW);

    expect(cache.get(at(7 * 60))).toBe(first);
    expect(cache.get(at(8 * 60 + 1))).not.toBe(first);
  });
});

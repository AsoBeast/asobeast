import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import {
  ANDROID_PUBLISHER_SCOPE,
  GCS_READ_ONLY_SCOPE,
  GOOGLE_TOKEN_AUDIENCE,
  GoogleTokenCache,
  parseServiceAccount,
  serviceAccountGrant,
  ServiceAccountError,
  signAssertion,
} from './service-account';

const PEM = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

const KEY = {
  type: 'service_account',
  project_id: 'asobeast-play',
  private_key_id: 'a1b2c3d4e5',
  private_key: PEM,
  client_email: 'reports@asobeast-play.iam.gserviceaccount.com',
};

const NOW = new Date('2026-10-16T12:00:00.000Z');

const decode = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

describe('parseServiceAccount', () => {
  it('accepts only the 2048 bit rsa keys google issues, before any signing', () => {
    for (const modulusLength of [1024, 3072]) {
      const pem = generateKeyPairSync('rsa', { modulusLength })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();

      expect(() =>
        parseServiceAccount(
          JSON.stringify({
            client_email: 'a@b.iam.gserviceaccount.com',
            private_key_id: 'k',
            private_key: pem,
          }),
        ),
      ).toThrow(ServiceAccountError);
    }
  });

  it('reads the client email, key id and private key from the JSON', () => {
    expect(parseServiceAccount(JSON.stringify(KEY))).toEqual({
      clientEmail: KEY.client_email,
      privateKeyId: KEY.private_key_id,
      privateKey: PEM,
    });
  });

  it.each(['client_email', 'private_key_id', 'private_key'])(
    'refuses a JSON without %s and names it',
    (field) => {
      const partial = { ...KEY, [field]: undefined };

      expect(() => parseServiceAccount(JSON.stringify(partial))).toThrow(
        ServiceAccountError,
      );
      expect(() => parseServiceAccount(JSON.stringify(partial))).toThrow(field);
    },
  );

  it('refuses text that is not JSON without echoing it', () => {
    const attempt = () => parseServiceAccount('{"private_key": "-----BEGIN');

    expect(attempt).toThrow(ServiceAccountError);
    expect(attempt).not.toThrow('BEGIN');
  });

  it('refuses a key that is not an RSA private key', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString();

    expect(() =>
      parseServiceAccount(JSON.stringify({ ...KEY, private_key: ec })),
    ).toThrow('RSA');
  });
});

describe('signAssertion', () => {
  it('signs an hour long RS256 assertion for the read only storage scope', () => {
    const account = parseServiceAccount(JSON.stringify(KEY));
    const assertion = signAssertion(account, NOW);
    const [header, payload, signature] = assertion.split('.');

    expect(decode(header)).toEqual({
      alg: 'RS256',
      typ: 'JWT',
      kid: KEY.private_key_id,
    });
    expect(decode(payload)).toEqual({
      iss: KEY.client_email,
      scope: GCS_READ_ONLY_SCOPE,
      aud: GOOGLE_TOKEN_AUDIENCE,
      iat: 1_792_152_000,
      exp: 1_792_152_000 + 3600,
    });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        createPublicKey(PEM),
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });
});

describe('signAssertion scope', () => {
  it('signs the scope it is given and keeps the read only scope by default', () => {
    const account = parseServiceAccount(JSON.stringify(KEY));
    const scopeOf = (assertion: string) =>
      decode(assertion.split('.')[1]).scope;

    expect(scopeOf(signAssertion(account, NOW, ANDROID_PUBLISHER_SCOPE))).toBe(
      'https://www.googleapis.com/auth/androidpublisher',
    );
    expect(scopeOf(signAssertion(account, NOW))).toBe(GCS_READ_ONLY_SCOPE);
  });

  it('signs the scope its grant was built for', async () => {
    const forms: Record<string, string>[] = [];
    const cache = new GoogleTokenCache(
      serviceAccountGrant(
        parseServiceAccount(JSON.stringify(KEY)),
        ANDROID_PUBLISHER_SCOPE,
      ),
      (form) => {
        forms.push(form);
        return Promise.resolve({ access_token: 'ya29', expires_in: 3600 });
      },
    );

    await cache.get(NOW);

    expect(decode(forms[0].assertion.split('.')[1]).scope).toBe(
      ANDROID_PUBLISHER_SCOPE,
    );
  });
});

describe('GoogleTokenCache', () => {
  it('exchanges once and reuses the token until a minute before it expires', async () => {
    const exchange = jest.fn(() =>
      Promise.resolve({ access_token: 'ya29.token', expires_in: 3600 }),
    );
    const cache = new GoogleTokenCache(
      serviceAccountGrant(parseServiceAccount(JSON.stringify(KEY))),
      exchange,
    );
    const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

    await expect(cache.get(NOW)).resolves.toBe('ya29.token');
    await cache.get(at(58 * 60));
    expect(exchange).toHaveBeenCalledTimes(1);

    await cache.get(at(59 * 60 + 1));
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('sends the grant built for the moment of the exchange', async () => {
    const exchange = jest.fn((form: Record<string, string>) =>
      Promise.resolve({ access_token: form.grant_type, expires_in: 3600 }),
    );
    const grant = jest.fn(() => ({ grant_type: 'refresh_token' }));

    await expect(new GoogleTokenCache(grant, exchange).get(NOW)).resolves.toBe(
      'refresh_token',
    );
    expect(grant).toHaveBeenCalledWith(NOW);
  });
});

describe('serviceAccountGrant', () => {
  it('sends a JWT bearer assertion signed at the given moment', () => {
    const account = parseServiceAccount(JSON.stringify(KEY));
    const form = serviceAccountGrant(account)(NOW);

    expect(form.grant_type).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(form.assertion).toBe(signAssertion(account, NOW));
  });
});

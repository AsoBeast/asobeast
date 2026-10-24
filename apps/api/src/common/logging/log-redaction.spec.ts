import { REQUEST_BODY_LIMIT_BYTES } from '@asobeast/shared';
import {
  CIRCULAR,
  REDACTED,
  TRUNCATED,
  scrubSecrets,
  scrubText,
} from './log-redaction';

const AUTH_SECRET = '0123456789abcdef0123456789abcdef';
const OPENAI_KEY = 'sk-proj-AAAABBBBCCCCDDDDEEEEFFFF';
const SMTP_PASSWORD = 'correct-horse-battery-staple';
const LITERALS = [AUTH_SECRET, OPENAI_KEY, SMTP_PASSWORD];

describe('scrubSecrets', () => {
  it('removes every secret shape from a logged object', () => {
    const scrubbed = scrubSecrets(
      {
        authorization: 'Bearer asob_9f2c1a7b4e6d8c0a1b2c3d4e',
        headers: { cookie: 'asobeast_session=eyJhbGciOiJIUzI1NiJ9.payload' },
        stripe: {
          key: 'sk_live_EXAMPLENOTREAL',
          webhook: 'whsec_7a8b9c0d1e2f3a4b5c6d7e8f',
        },
        proxy: 'http://poolUser:poolPass@proxy.webshare.io:9999',
        env: {
          AUTH_SECRET,
          OPENAI_API_KEY: OPENAI_KEY,
          SMTP_PASSWORD,
        },
        message: `booted with ${AUTH_SECRET}`,
        keyword: 'habit tracker',
      },
      LITERALS,
    );

    const serialized = JSON.stringify(scrubbed);
    for (const secret of [
      'asob_9f2c1a7b4e6d8c0a1b2c3d4e',
      'eyJhbGciOiJIUzI1NiJ9.payload',
      'sk_live_EXAMPLENOTREAL',
      'whsec_7a8b9c0d1e2f3a4b5c6d7e8f',
      'poolPass',
      AUTH_SECRET,
      OPENAI_KEY,
      SMTP_PASSWORD,
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(scrubbed.keyword).toBe('habit tracker');
  });

  it('redacts a secret key whatever its value', () => {
    expect(scrubSecrets({ nested: { password: 'plain' } }, [])).toEqual({
      nested: { password: REDACTED },
    });
  });

  it('redacts a private key field even without its PEM header', () => {
    expect(
      scrubSecrets(
        { privateKey: 'MIGHAgEAMBMGByqGSM49AgEGCCqG', private_key: 'MIIEv' },
        [],
      ),
    ).toEqual({ privateKey: REDACTED, private_key: REDACTED });
  });

  it('keeps the host of a credentialed url readable', () => {
    expect(scrubText('http://user:pass@proxy.example.com:80', [])).toBe(
      `http://${REDACTED}@proxy.example.com:80`,
    );
  });

  it('scrubs a body-sized run of letters in linear time', () => {
    const text = `App ${'a'.repeat(REQUEST_BODY_LIMIT_BYTES)}`;

    const started = performance.now();
    const scrubbed = scrubText(text, []);

    expect(performance.now() - started).toBeLessThan(250);
    expect(scrubbed).toBe(text);
  });

  it('redacts a credentialed url behind an overlong scheme', () => {
    const scrubbed = scrubText(
      `${'a'.repeat(100)}://user:pass@proxy.example.com`,
      [],
    );

    expect(scrubbed).not.toContain('pass@');
    expect(scrubbed).toContain(`${REDACTED}@proxy.example.com`);
  });

  it('scrubs an error message, stack and cause while keeping its shape', () => {
    const error = new Error(`failed for ${AUTH_SECRET}`, {
      cause: new Error(`caused by ${AUTH_SECRET}`),
    });
    Object.assign(error, { statusCode: 502 });

    const scrubbed = scrubSecrets({ err: error }, LITERALS).err;

    expect(scrubbed).toBeInstanceOf(Error);
    expect(scrubbed.message).toBe(`failed for ${REDACTED}`);
    expect(scrubbed.stack).not.toContain(AUTH_SECRET);
    expect((scrubbed.cause as Error).message).toBe(`caused by ${REDACTED}`);
    expect(scrubbed).toHaveProperty('statusCode', 502);
  });

  it('walks arrays and leaves ordinary values alone', () => {
    expect(scrubSecrets({ counts: [1, 2, 3], ok: true }, [])).toEqual({
      counts: [1, 2, 3],
      ok: true,
    });
  });

  it('ignores short literals that would redact ordinary words', () => {
    expect(scrubText('the keyword is fitness', ['fit'])).toBe(
      'the keyword is fitness',
    );
  });

  it('truncates rather than returning a raw subtree past the depth limit', () => {
    const buried = { password: SMTP_PASSWORD, token: 'asob_deadbeefcafe1234' };
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: buried } } } } } } } };

    const serialized = JSON.stringify(scrubSecrets(deep, LITERALS));

    expect(serialized).toContain(TRUNCATED);
    expect(serialized).not.toContain(SMTP_PASSWORD);
    expect(serialized).not.toContain('asob_deadbeefcafe1234');
  });

  it('scrubs a secret-shaped string that sits below the depth limit', () => {
    const deep = {
      a: { b: { c: { d: { e: { f: { g: { h: OPENAI_KEY } } } } } } },
    };

    expect(JSON.stringify(scrubSecrets(deep, LITERALS))).not.toContain(
      OPENAI_KEY,
    );
  });

  it('keeps an error whole when its properties sit on the depth limit', () => {
    const error = new Error(`failed for ${AUTH_SECRET}`);
    Object.assign(error, { statusCode: 502 });
    const deep = { a: { b: { c: { d: { e: { f: { g: error } } } } } } };

    const scrubbed = scrubSecrets(deep, LITERALS).a.b.c.d.e.f.g;

    expect(scrubbed).toBeInstanceOf(Error);
    expect(scrubbed.message).toBe(`failed for ${REDACTED}`);
    expect(Object.keys(scrubbed)).not.toContain('0');
  });

  it('marks a cycle instead of recursing forever', () => {
    const node: Record<string, unknown> = { name: 'root' };
    node.self = node;

    expect(scrubSecrets(node, [])).toEqual({ name: 'root', self: CIRCULAR });
  });
});

describe('scrubText and key material', () => {
  const PEM = [
    '-----BEGIN PRIVATE KEY-----',
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg',
    'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
    '-----END PRIVATE KEY-----',
  ].join('\n');

  const JWT =
    'eyJhbGciOiJFUzI1NiIsImtpZCI6IjJYOVI0SFhGMzQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiI1NzI0NjU0MiIsImV4cCI6MTc5MTM3NTAwMH0.MEUCIQDabcdefghijklmnop';

  it('scrubs a PEM private key block wherever it appears in a message', () => {
    const scrubbed = scrubText(`key was ${PEM} and then it failed`, []);

    expect(scrubbed).toBe(`key was ${REDACTED} and then it failed`);
    expect(scrubbed).not.toContain('MIGHAgEAMBMG');
  });

  it('scrubs the other PEM flavours too', () => {
    const rsa =
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';
    const ec =
      '-----BEGIN EC PRIVATE KEY-----\nabc\n-----END EC PRIVATE KEY-----';

    expect(scrubText(`${rsa} ${ec}`, [])).toBe(`${REDACTED} ${REDACTED}`);
  });

  it('keeps a public key, which is not a secret', () => {
    const publicKey =
      '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----';

    expect(scrubText(publicKey, [])).toBe(publicKey);
  });

  it('scrubs a google access token', () => {
    expect(
      scrubText('bearer ya29.a0AfB_byC3x9Kq-ZtLm2PpQw8rTnY4 failed', []),
    ).toBe(`bearer ${REDACTED} failed`);
  });

  it('scrubs a signed JWT', () => {
    expect(scrubText(`Bearer ${JWT} was refused`, [])).toBe(
      `Bearer ${REDACTED} was refused`,
    );
  });

  it('leaves a dotted version number alone', () => {
    expect(scrubText('upgraded 1.8.0 to 1.9.0', [])).toBe(
      'upgraded 1.8.0 to 1.9.0',
    );
  });

  it('scrubs both from a logged object', () => {
    const scrubbed = JSON.stringify(
      scrubSecrets({ detail: PEM, trace: JWT }, []),
    );

    expect(scrubbed).not.toContain('MIGHAgEAMBMG');
    expect(scrubbed).not.toContain('eyJhbGci');
  });
});

const ISSUE_URL =
  '/no-such-route?token=asob_EXAMPLE&password=hunter2hunter2&access_token=ACCTOKMARKER&api_key=APIKEYMARKER&secret=SECRETMARK2';
const ISSUE_VALUES = [
  'asob_EXAMPLE',
  'hunter2hunter2',
  'ACCTOKMARKER',
  'APIKEYMARKER',
  'SECRETMARK2',
];

describe('query credentials', () => {
  it('redacts every secret value of the url the issue reported', () => {
    expect(scrubText(ISSUE_URL, [])).toBe(
      `/no-such-route?token=${REDACTED}&password=${REDACTED}&access_token=${REDACTED}&api_key=${REDACTED}&secret=${REDACTED}`,
    );
  });

  it('gives the url and the query object of one request the same answer', () => {
    const logged = {
      url: ISSUE_URL,
      query: {
        token: 'asob_EXAMPLE',
        password: 'hunter2hunter2',
        access_token: 'ACCTOKMARKER',
        api_key: 'APIKEYMARKER',
        secret: 'SECRETMARK2',
        country: 'us',
      },
    };

    const serialized = JSON.stringify(scrubSecrets(logged, []));

    for (const value of ISSUE_VALUES) {
      expect(serialized).not.toContain(value);
    }
    expect(scrubSecrets(logged, []).query).toEqual({
      token: REDACTED,
      password: REDACTED,
      access_token: REDACTED,
      api_key: REDACTED,
      secret: REDACTED,
      country: 'us',
    });
  });

  it.each([
    'access_token',
    'refresh_token',
    'id_token',
    'auth_token',
    'accessToken',
    'client_secret',
    'clientSecret',
    'passwd',
    'pwd',
    'private_key',
    'apiKey',
    'API-KEY',
  ])('redacts %s in a url and in an object', (name) => {
    expect(scrubText(`/x?${name}=value123`, [])).toBe(`/x?${name}=${REDACTED}`);
    expect(scrubSecrets({ [name]: 'value123' }, [])).toEqual({
      [name]: REDACTED,
    });
  });

  it('keeps every other byte of the url, ; and the fragment included', () => {
    expect(scrubText('/search?q=a;b&Password=p&sort=asc&page=2#top', [])).toBe(
      `/search?q=a;b&Password=${REDACTED}&sort=asc&page=2#top`,
    );
  });

  it('redacts an encoded name and keeps it as it was written', () => {
    expect(scrubText('/x?pass%77ord=abc&Q=1', [])).toBe(
      `/x?pass%77ord=${REDACTED}&Q=1`,
    );
    expect(scrubText('/x?%61ccess_token=abc', [])).toBe(
      `/x?%61ccess_token=${REDACTED}`,
    );
  });

  it('redacts every occurrence of a repeated name', () => {
    expect(scrubText('/x?password=a&password=b&q=c', [])).toBe(
      `/x?password=${REDACTED}&password=${REDACTED}&q=c`,
    );
  });

  it('redacts a bracketed name in the url and in the object', () => {
    expect(scrubText('/x?password[]=a&filter[token]=b&other[]=c', [])).toBe(
      `/x?password[]=${REDACTED}&filter[token]=${REDACTED}&other[]=c`,
    );
    expect(scrubSecrets({ 'password[]': 'a', 'other[]': 'c' }, [])).toEqual({
      'password[]': REDACTED,
      'other[]': 'c',
    });
  });

  it('redacts a credential that follows a semicolon', () => {
    expect(scrubText('/x?a=1;password=p&b=2', [])).toBe(
      `/x?a=1;password=${REDACTED}&b=2`,
    );
  });

  it('does not leave the tail of a credential that holds a raw semicolon', () => {
    expect(scrubText('/x?password=ab;cd&q=1', [])).toBe(
      `/x?password=${REDACTED}&q=1`,
    );
  });

  it.each([`ab'cd`, 'ab"cd', `it's-secret`])(
    'does not leave the tail of a credential that holds a raw quote: %s',
    (value) => {
      expect(scrubText(`/x?password=${value}&q=1`, [])).toBe(
        `/x?password=${REDACTED}&q=1`,
      );
    },
  );

  it('redacts an empty value and leaves a name without a value alone', () => {
    expect(scrubText('/x?password=&q=1', [])).toBe(
      `/x?password=${REDACTED}&q=1`,
    );
    expect(scrubText('/x?password&q=1', [])).toBe('/x?password&q=1');
  });

  it('leaves names that only look like a secret name', () => {
    const url =
      '/x?passwords=1&tokens=2&keyword=password&key=v&monkey=1&code=9';

    expect(scrubText(url, [])).toBe(url);
  });

  it('keeps a name with a malformed escape instead of throwing', () => {
    expect(scrubText('/x?%zzpassword=1&password=2', [])).toBe(
      `/x?%zzpassword=1&password=${REDACTED}`,
    );
  });

  it('redacts a credential inside an error message', () => {
    expect(scrubText('GET /apps?access_token=abc123 failed with 502', [])).toBe(
      `GET /apps?access_token=${REDACTED} failed with 502`,
    );
  });

  it('still redacts an api token held by a parameter of any name', () => {
    const token = 'asob_0123456789abcdef0123456789abcdef';

    expect(scrubText(`/mcp?key=${token}&q=1`, [])).toBe(
      `/mcp?key=${REDACTED}&q=1`,
    );
  });

  it.each(['&', '?', ';a', '&password=', '&a'])(
    'scrubs a body-sized run of %s in linear time',
    (unit) => {
      const text = unit.repeat(REQUEST_BODY_LIMIT_BYTES / unit.length);

      const started = performance.now();
      scrubText(text, []);

      expect(performance.now() - started).toBeLessThan(250);
    },
  );
});

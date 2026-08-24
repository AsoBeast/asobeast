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

  it('keeps the host of a credentialed url readable', () => {
    expect(scrubText('http://user:pass@proxy.example.com:80', [])).toBe(
      `http://${REDACTED}@proxy.example.com:80`,
    );
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

import { describe, expect, it } from 'vitest';
import { REQUEST_BODY_LIMIT_BYTES } from './request-body';
import { URL_CREDENTIALS } from './url-credentials';

const redact = (text: string) => text.replace(URL_CREDENTIALS, '$1***@');

describe('URL_CREDENTIALS', () => {
  it('keeps the scheme and host of a credentialed url', () => {
    expect(redact('http://user:pass@proxy.example.com:80')).toBe(
      'http://***@proxy.example.com:80',
    );
  });

  it.each([
    ['letters', `${'a'.repeat(100)}://user:pass@host`],
    ['digits', `a${'1'.repeat(40)}://user:pass@host`],
    ['punctuation', `x${'-'.repeat(40)}://user:pass@host`],
  ])(
    'matches a credentialed url behind an overlong scheme of %s',
    (_, text) => {
      expect(redact(text)).not.toContain('pass@');
    },
  );

  it('leaves a url without credentials alone', () => {
    expect(redact('https://api.example.com/backend?q=1')).toBe(
      'https://api.example.com/backend?q=1',
    );
  });

  it.each([
    ['letters', 'a'.repeat(REQUEST_BODY_LIMIT_BYTES)],
    [
      'a scheme without credentials',
      `x://${'a'.repeat(REQUEST_BODY_LIMIT_BYTES)}`,
    ],
    [
      'a password without a host',
      `x://a:${'b'.repeat(REQUEST_BODY_LIMIT_BYTES)}`,
    ],
    ['digits', '1'.repeat(REQUEST_BODY_LIMIT_BYTES)],
  ])('scans a body-sized run of %s in linear time', (_, text) => {
    const started = performance.now();
    redact(text);

    expect(performance.now() - started).toBeLessThan(250);
  });
});

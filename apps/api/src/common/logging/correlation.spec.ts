import { CORRELATION_HEADER, correlationIdOf } from './correlation';

describe('correlationIdOf', () => {
  it('keeps a well formed supplied id', () => {
    expect(correlationIdOf({ [CORRELATION_HEADER]: 'req-42.a_b' })).toBe(
      'req-42.a_b',
    );
  });

  it('falls back to the request id header', () => {
    expect(correlationIdOf({ 'x-request-id': 'abc123' })).toBe('abc123');
  });

  it('generates one when the header is absent', () => {
    expect(correlationIdOf({})).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an id carrying characters that would forge a log line', () => {
    const forged = correlationIdOf({ [CORRELATION_HEADER]: 'a"} {"level":60' });
    expect(forged).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an id longer than the bound', () => {
    const long = correlationIdOf({ [CORRELATION_HEADER]: 'a'.repeat(65) });
    expect(long).toMatch(/^[0-9a-f-]{36}$/);
  });
});

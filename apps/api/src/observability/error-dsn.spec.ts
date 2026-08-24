import {
  InvalidErrorTrackingDsnError,
  parseErrorTrackingDsn,
} from './error-dsn';

describe('parseErrorTrackingDsn', () => {
  it('builds the envelope endpoint from a hosted dsn', () => {
    expect(
      parseErrorTrackingDsn('https://abc123@o1.ingest.sentry.io/4507'),
    ).toEqual({
      envelopeUrl: 'https://o1.ingest.sentry.io/api/4507/envelope/',
      publicKey: 'abc123',
      projectId: '4507',
    });
  });

  it('keeps a path prefix from a self hosted dsn', () => {
    expect(
      parseErrorTrackingDsn('https://abc123@errors.example.com/prefix/9'),
    ).toMatchObject({
      envelopeUrl: 'https://errors.example.com/prefix/api/9/envelope/',
      projectId: '9',
    });
  });

  it.each([
    ['not-a-url', 'it is not a url'],
    ['ftp://key@host/1', 'only http and https are supported'],
    ['https://host/1', 'it carries no public key'],
    ['https://key@host', 'it carries no project id'],
  ])('refuses %s', (dsn, reason) => {
    expect(() => parseErrorTrackingDsn(dsn)).toThrow(
      InvalidErrorTrackingDsnError,
    );
    expect(() => parseErrorTrackingDsn(dsn)).toThrow(reason);
  });
});

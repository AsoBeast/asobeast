import { assertTestDatabase } from './helpers/test-database';

describe('assertTestDatabase', () => {
  it.each([
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test',
    'postgres://asobeast:asobeast@localhost:5433/asobeast_test',
    'postgresql://asobeast:asobeast@127.0.0.1:5433/asobeast_test',
    'postgresql://asobeast:asobeast@[::1]:5433/asobeast_test',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?schema=public',
    'postgresql:///asobeast_test?host=/var/run/postgresql',
  ])('accepts %s', (url) => {
    expect(() => assertTestDatabase(url)).not.toThrow();
  });

  it.each([
    'postgresql://asobeast:asobeast@localhost:5433/asobeast',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test_copy',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test/',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast?schema=_test',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast#_test',
    'postgresql://asobeast_test:asobeast@localhost:5433/asobeast',
    'postgresql://asobeast:asobeast@localhost:5433/',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast%5Ftest',
    'mysql://asobeast:asobeast@localhost:3306/asobeast_test',
    'asobeast_test',
    '',
  ])('refuses %s', (url) => {
    expect(() => assertTestDatabase(url)).toThrow(/ending in _test/);
  });

  it.each([
    'postgresql://asobeast:asobeast@db.internal:5433/asobeast_test',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?host=db.internal',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?host=',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?hostaddr=10.0.0.1',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?service=prod',
    'postgresql://asobeast:asobeast@localhost:5433/asobeast_test?host=localhost&host=db.internal',
    'postgresql:///asobeast_test',
  ])('refuses the remote or unset host of %s', (url) => {
    expect(() => assertTestDatabase(url)).toThrow(
      /loopback host or unix socket/,
    );
  });

  it('refuses an unset url', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/ending in _test/);
  });

  it('names the refused database without its credentials', () => {
    const refuse = () =>
      assertTestDatabase('postgresql://asobeast:s3cret@db.internal:5433/prod');
    expect(refuse).toThrow(/got "prod"\.$/);
    expect(refuse).not.toThrow(/s3cret/);
  });

  it('names the refused host without its credentials', () => {
    const refuse = () =>
      assertTestDatabase(
        'postgresql://asobeast:s3cret@db.internal:5433/asobeast_test',
      );
    expect(refuse).toThrow(/got "db\.internal"\.$/);
    expect(refuse).not.toThrow(/s3cret/);
  });
});

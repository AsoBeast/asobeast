import { pathWithoutQuery, withoutQueryEcho } from './request-path';

describe('pathWithoutQuery', () => {
  it.each([
    ['/apps', '/apps'],
    ['/apps?token=asob_abc', '/apps'],
    ['/apps?', '/apps'],
    ['/apps?a=1?b=2', '/apps'],
    ['/apps#fragment', '/apps'],
    ['/?x', '/'],
    ['', ''],
    ['/apps/ça?q=ü', '/apps/ça'],
  ])('turns %s into %s', (url, path) => {
    expect(pathWithoutQuery(url)).toBe(path);
  });
});

describe('withoutQueryEcho', () => {
  const request = { method: 'GET', originalUrl: '/nope?token=asob_abc' };

  it('cuts the query string out of the unknown route message', () => {
    expect(
      withoutQueryEcho({ message: 'Cannot GET /nope?token=asob_abc' }, request),
    ).toEqual({ message: 'Cannot GET /nope' });
  });

  it('leaves any other message alone, question marks included', () => {
    const error = { message: 'name must not be empty?' };

    expect(withoutQueryEcho(error, request)).toBe(error);
  });

  it('keeps the other fields of the error', () => {
    const result = withoutQueryEcho(
      { message: 'Cannot GET /nope?token=asob_abc', statusCode: 404 },
      request,
    );

    expect(result).toEqual({ message: 'Cannot GET /nope', statusCode: 404 });
  });
});

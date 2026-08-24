import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureCors, servedOrigin } from './cors';

function appServing(webPublicUrl: string | undefined): {
  app: INestApplication;
  allowed: unknown[];
} {
  const allowed: unknown[] = [];
  const app = {
    get: () => ({ get: () => webPublicUrl }) as unknown as ConfigService,
    enableCors: (options: unknown) => {
      allowed.push(options);
    },
  } as unknown as INestApplication;
  return { app, allowed };
}

describe('servedOrigin', () => {
  it('reads the origin of the public url', () => {
    expect(servedOrigin('https://aso.example.com')).toBe(
      'https://aso.example.com',
    );
  });

  it('drops a path and a trailing slash the operator left on it', () => {
    expect(servedOrigin('https://aso.example.com/')).toBe(
      'https://aso.example.com',
    );
    expect(servedOrigin('https://aso.example.com/settings')).toBe(
      'https://aso.example.com',
    );
  });

  it('keeps a non default port, because the browser sends it', () => {
    expect(servedOrigin('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('has no origin to serve when the public url is unset', () => {
    expect(servedOrigin(undefined)).toBeNull();
    expect(servedOrigin('')).toBeNull();
  });

  it('has no origin to serve when the public url cannot be read', () => {
    expect(servedOrigin('not a url')).toBeNull();
  });

  it('refuses a url the browser has no origin for', () => {
    expect(servedOrigin('mailto:ops@example.com')).toBeNull();
    expect(servedOrigin('file:///etc/passwd')).toBeNull();
    expect(servedOrigin('javascript:alert(1)')).toBeNull();
    expect(servedOrigin('data:text/html,<p>hi</p>')).toBeNull();
  });
});

describe('configureCors', () => {
  it('allows only the origin the deployment serves', () => {
    const { app, allowed } = appServing('https://aso.example.com');

    configureCors(app);

    expect(allowed).toEqual([{ origin: ['https://aso.example.com'] }]);
  });

  it('sends no cors headers at all when no public url is set', () => {
    const { app, allowed } = appServing(undefined);

    configureCors(app);

    expect(allowed).toEqual([]);
  });

  it('never allows the opaque null origin a schemeless url would produce', () => {
    const { app, allowed } = appServing('mailto:ops@example.com');

    configureCors(app);

    expect(allowed).toEqual([]);
  });
});

import { REDACTED } from '../common/logging/log-redaction';
import { errorEvent, maskRoute, MAX_STACK_FRAMES } from './error-event';

const AUTH_SECRET = '0123456789abcdef0123456789abcdef';

const context = {
  secrets: [AUTH_SECRET],
  environment: 'production',
  release: '1.0.0',
  workspaceId: 'ws_a',
  correlationId: 'corr-1',
};

const now = new Date('2026-08-14T12:00:00.000Z');

describe('maskRoute', () => {
  it('replaces identifiers with a placeholder', () => {
    expect(maskRoute('/apps/clx8s9k2l0000abcdefghijkl/keywords')).toBe(
      '/apps/:id/keywords',
    );
    expect(maskRoute('/actions/42')).toBe('/actions/:id');
  });

  it('drops the query string, which can carry customer terms', () => {
    expect(maskRoute('/keywords/suggestions?term=habit+tracker')).toBe(
      '/keywords/suggestions',
    );
  });

  it('keeps a route with no identifier as it is', () => {
    expect(maskRoute('/apps')).toBe('/apps');
  });
});

describe('errorEvent', () => {
  it('tags the workspace and correlation without naming the user', () => {
    const event = errorEvent(new Error('boom'), context, 'abc', now);

    expect(event.tags).toEqual({ workspace: 'ws_a', correlation: 'corr-1' });
    expect(event.environment).toBe('production');
    expect(event.release).toBe('1.0.0');
    expect(event.timestamp).toBe(now.getTime() / 1000);
  });

  it('scrubs configured secrets from the message and the stack', () => {
    const event = errorEvent(
      new Error(`connect failed for ${AUTH_SECRET}`),
      context,
      'abc',
      now,
    );

    expect(event.exception.values[0].value).toBe(
      `connect failed for ${REDACTED}`,
    );
    expect(JSON.stringify(event)).not.toContain(AUTH_SECRET);
  });

  it('sends the masked route rather than the requested url', () => {
    const event = errorEvent(
      new Error('boom'),
      {
        ...context,
        method: 'GET',
        path: '/apps/clx8s9k2l0000abcdefghijkl?term=habit',
      },
      'abc',
      now,
    );

    expect(event.request).toEqual({ method: 'GET', url: '/apps/:id' });
  });

  it('omits the request when no route was in flight', () => {
    expect(
      errorEvent(new Error('boom'), context, 'abc', now).request,
    ).toBeUndefined();
  });

  it('bounds the stack it ships', () => {
    const error = new Error('boom');
    error.stack = ['Error: boom']
      .concat(Array<string>(80).fill('    at frame'))
      .join('\n');

    expect(
      errorEvent(error, context, 'abc', now).exception.values[0].stacktrace
        .frames,
    ).toHaveLength(MAX_STACK_FRAMES);
  });

  it('accepts a thrown value that is not an error', () => {
    const event = errorEvent('plain failure', context, 'abc', now);

    expect(event.exception.values[0].value).toBe('plain failure');
  });
});

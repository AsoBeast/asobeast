import type { ErrorEvent } from '@sentry/nestjs';
import { REDACTED } from '../common/logging/log-redaction';
import { maskRoute, scrubEvent } from './error-event';

const AUTH_SECRET = '0123456789abcdef0123456789abcdef';

const secrets = [AUTH_SECRET];

function eventWith(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    event_id: 'abc',
    exception: {
      values: [
        {
          type: 'Error',
          value: 'boom',
          stacktrace: {
            frames: [
              {
                filename: '/repo/apps/api/src/apps/apps.service.ts',
                function: 'import',
                lineno: 42,
                colno: 7,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
    ...overrides,
  } as ErrorEvent;
}

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

describe('scrubEvent', () => {
  it('keeps the structured frames the sdk parsed', () => {
    const frames = scrubEvent(eventWith(), secrets).exception?.values?.[0]
      .stacktrace?.frames;

    expect(frames?.[0]).toMatchObject({
      filename: '/repo/apps/api/src/apps/apps.service.ts',
      lineno: 42,
      colno: 7,
      in_app: true,
    });
  });

  it('scrubs configured secrets from the message and the stack', () => {
    const event = eventWith({
      message: `connect failed for ${AUTH_SECRET}`,
      extra: { detail: `token ${AUTH_SECRET}` },
    });

    const scrubbed = scrubEvent(event, secrets);

    expect(scrubbed.message).toBe(`connect failed for ${REDACTED}`);
    expect(JSON.stringify(scrubbed)).not.toContain(AUTH_SECRET);
  });

  it('sends the masked route and drops headers, cookies, body and query', () => {
    const event = eventWith({
      request: {
        method: 'GET',
        url: '/apps/clx8s9k2l0000abcdefghijkl',
        query_string: 'term=habit+tracker',
        headers: { authorization: 'Bearer asob_live' },
        cookies: { asobeast_session: 'value' },
        data: { password: 'hunter2' },
      },
    });

    expect(scrubEvent(event, secrets).request).toEqual({
      method: 'GET',
      url: '/apps/:id',
    });
  });

  it('masks identifiers out of the transaction name', () => {
    const event = eventWith({
      transaction: 'GET /apps/clx8s9k2l0000abcdefghijkl?term=habit',
    });

    expect(scrubEvent(event, secrets).transaction).toBe('GET /apps/:id');
  });

  it('leaves an event with no request alone', () => {
    expect(scrubEvent(eventWith(), secrets).request).toBeUndefined();
  });
});

import type { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import type { Env } from '../config/env';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { ErrorTracking } from './error-tracking.service';

jest.mock('undici', () => ({ request: jest.fn().mockResolvedValue({}) }));

const send = request as unknown as jest.Mock;

const DSN = 'https://publickey@errors.example.com/7';
const AUTH_SECRET = '0123456789abcdef0123456789abcdef';

function configOf(values: Partial<Env>): ConfigService<Env, true> {
  const resolved: Record<string, unknown> = {
    NODE_ENV: 'production',
    AUTH_SECRET,
    ...values,
  };
  return {
    get: (key: string) => resolved[key],
  } as unknown as ConfigService<Env, true>;
}

function trackerOf(values: Partial<Env>) {
  const workspace = new WorkspaceContext();
  const tracking = new ErrorTracking(configOf(values), workspace);
  tracking.onModuleInit();
  return { tracking, workspace };
}

describe('ErrorTracking', () => {
  beforeEach(() => send.mockClear());

  it('stays inert with no dsn configured', () => {
    const { tracking } = trackerOf({ BILLING_ENABLED: true });

    tracking.capture(new Error('boom'));

    expect(tracking.enabled).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('stays inert on a self hosted instance even with a dsn', () => {
    const { tracking } = trackerOf({
      ERROR_TRACKING_DSN: DSN,
      BILLING_ENABLED: false,
    });

    tracking.capture(new Error('boom'));

    expect(tracking.enabled).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('stays inert on a dsn it cannot parse', () => {
    const { tracking } = trackerOf({
      ERROR_TRACKING_DSN: 'not-a-dsn',
      BILLING_ENABLED: true,
    });

    expect(tracking.enabled).toBe(false);
  });

  it('posts a scrubbed envelope tagged with the workspace', async () => {
    const { tracking, workspace } = trackerOf({
      ERROR_TRACKING_DSN: DSN,
      BILLING_ENABLED: true,
    });

    await workspace.runScope(
      { workspaceId: 'ws_a', correlationId: 'corr-1' },
      () => {
        tracking.capture(new Error(`failed for ${AUTH_SECRET}`), {
          method: 'GET',
          path: '/apps/clx8s9k2l0000abcdefghijkl',
        });
        return Promise.resolve();
      },
    );

    expect(tracking.enabled).toBe(true);
    const [url, options] = send.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://errors.example.com/api/7/envelope/');
    expect(options.headers['x-sentry-auth']).toContain('sentry_key=publickey');

    const [envelope, item, event] = options.body
      .split('\n')
      .map(JSON.parse) as [
      { event_id: string },
      { type: string },
      { tags: Record<string, string>; request: { url: string } },
    ];
    expect(item.type).toBe('event');
    expect(envelope.event_id).toHaveLength(32);
    expect(event.tags).toEqual({ workspace: 'ws_a', correlation: 'corr-1' });
    expect(event.request.url).toBe('/apps/:id');
    expect(options.body).not.toContain(AUTH_SECRET);
  });
});

import type { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { Env } from '../config/env';
import { ErrorTracking } from './error-tracking.service';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
  withScope: jest.fn((run: (scope: unknown) => void) =>
    run({ setTags: jest.fn(), setTransactionName: jest.fn() }),
  ),
}));

const captureException = Sentry.captureException as jest.Mock;
const withScope = Sentry.withScope as unknown as jest.Mock;

const DSN = 'https://publickey@errors.example.com/7';

function configOf(values: Partial<Env>): ConfigService<Env, true> {
  const resolved: Record<string, unknown> = {
    NODE_ENV: 'production',
    BILLING_ENABLED: true,
    ...values,
  };
  return { get: (key: string) => resolved[key] } as ConfigService<Env, true>;
}

function trackerOf(values: Partial<Env>) {
  const workspace = new WorkspaceContext();
  const tracking = new ErrorTracking(configOf(values), workspace);
  tracking.onModuleInit();
  return { tracking, workspace };
}

describe('ErrorTracking', () => {
  beforeEach(() => {
    captureException.mockClear();
    withScope.mockClear();
  });

  it.each([
    ['no dsn configured', {}],
    [
      'a self hosted instance',
      { ERROR_TRACKING_DSN: DSN, BILLING_ENABLED: false },
    ],
    [
      'an instance outside production',
      { ERROR_TRACKING_DSN: DSN, NODE_ENV: 'development' as const },
    ],
  ])('stays inert on %s', (_case, values) => {
    const { tracking } = trackerOf(values);

    tracking.capture(new Error('boom'));

    expect(tracking.enabled).toBe(false);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports tagged with the workspace and the correlation in scope', async () => {
    const setTags = jest.fn();
    const setTransactionName = jest.fn();
    withScope.mockImplementation((run: (scope: unknown) => void) =>
      run({ setTags, setTransactionName }),
    );
    const { tracking, workspace } = trackerOf({ ERROR_TRACKING_DSN: DSN });
    const error = new Error('boom');

    await workspace.runScope(
      { workspaceId: 'ws_a', correlationId: 'corr-1' },
      () => {
        tracking.capture(error, {
          transaction: 'check-keyword',
          tags: { store: 'APP_STORE' },
        });
        return Promise.resolve();
      },
    );

    expect(tracking.enabled).toBe(true);
    expect(setTags).toHaveBeenCalledWith({
      workspace: 'ws_a',
      correlation: 'corr-1',
      store: 'APP_STORE',
    });
    expect(setTransactionName).toHaveBeenCalledWith('check-keyword');
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it('reports without tags when nothing is in scope', () => {
    const setTags = jest.fn();
    withScope.mockImplementation((run: (scope: unknown) => void) =>
      run({ setTags, setTransactionName: jest.fn() }),
    );
    const { tracking } = trackerOf({ ERROR_TRACKING_DSN: DSN });

    tracking.capture(new Error('boom'));

    expect(setTags).toHaveBeenCalledWith({});
  });
});

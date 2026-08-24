import { ConfigService } from '@nestjs/config';
import {
  ACTION_PRIORITIES,
  ActionOpenedPayload,
  ActionPriority,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { OpenedAction } from './actions.generator';
import { actionLink, ActionsNotifier, meetsPriority } from './actions.notifier';

const NOW = new Date('2026-07-30T03:10:00.000Z');
const WORKSPACE = 'ws_1';

const EVIDENCE = {
  rule: 'keyword.add_uncovered',
  opportunity: 66.5,
  indexedFields: ['title'],
  uncoveredFields: ['title'],
};

const opened = (overrides: Partial<OpenedAction> = {}): OpenedAction => ({
  id: 'act_1',
  workspaceId: WORKSPACE,
  fingerprint: 'fp_1',
  appId: 'app_1',
  keywordId: 'kw_1',
  rule: 'keyword.add_uncovered',
  priority: 'high',
  impact: 71,
  firstSeenAt: NOW,
  reopened: false,
  ...overrides,
});

const buildPrisma = (evidence: unknown = EVIDENCE) => ({
  actionItem: {
    findMany: jest.fn(() =>
      Promise.resolve([
        {
          id: 'act_1',
          rule: 'keyword.add_uncovered',
          evidence,
          app: {
            id: 'app_1',
            name: 'Budget',
            store: 'APP_STORE',
            country: 'us',
          },
          keyword: { id: 'kw_1', text: 'budget planner' },
        },
      ]),
    ),
  },
});

const notifierFor = (
  prisma: ReturnType<typeof buildPrisma>,
  minimum: ActionPriority = 'high',
  webPublicUrl: string | undefined = undefined,
) => {
  const alerts = { dispatch: jest.fn(() => Promise.resolve()) };
  const workspace = new WorkspaceContext();
  const notifier = new ActionsNotifier(
    prisma as unknown as PrismaService,
    {
      get: jest.fn((key: keyof Env) =>
        key === 'ALERT_ACTIONS_MIN_PRIORITY' ? minimum : webPublicUrl,
      ),
    } as unknown as ConfigService<Env, true>,
    alerts as unknown as AlertsDispatcher,
    workspace,
  );
  return {
    alerts,
    unscoped: notifier,
    notifier: {
      notify: (opened: OpenedAction[], now: Date) =>
        workspace.run(WORKSPACE, () => notifier.notify(opened, now)),
    },
  };
};

const dispatched = (alerts: { dispatch: jest.Mock }): ActionOpenedPayload[] =>
  alerts.dispatch.mock.calls.map(([payload]) => payload as ActionOpenedPayload);

describe('meetsPriority', () => {
  it('admits every priority at or above the minimum, at each setting', () => {
    const admitted = (minimum: ActionPriority): ActionPriority[] =>
      ACTION_PRIORITIES.filter((priority) => meetsPriority(priority, minimum));

    expect(admitted('critical')).toEqual(['critical']);
    expect(admitted('high')).toEqual(['critical', 'high']);
    expect(admitted('medium')).toEqual(['critical', 'high', 'medium']);
    expect(admitted('low')).toEqual([...ACTION_PRIORITIES]);
  });
});

describe('actionLink', () => {
  it('is null without a configured public url', () => {
    expect(actionLink(undefined, 'act_1')).toBeNull();
    expect(actionLink('', 'act_1')).toBeNull();
  });

  it('builds exactly one slash regardless of trailing slashes', () => {
    expect(actionLink('https://aso.example.com', 'act_1')).toBe(
      'https://aso.example.com/actions?action=act_1',
    );
    expect(actionLink('https://aso.example.com/', 'act_1')).toBe(
      'https://aso.example.com/actions?action=act_1',
    );
    expect(actionLink('https://aso.example.com///', 'act_1')).toBe(
      'https://aso.example.com/actions?action=act_1',
    );
  });
});

describe('ActionsNotifier', () => {
  it('dispatches nothing for an empty run', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma());

    expect(await notifier.notify([], NOW)).toBe(0);
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });

  it('emits a typed payload for a newly opened action', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma());

    expect(await notifier.notify([opened()], NOW)).toBe(1);
    expect(dispatched(alerts)[0]).toMatchObject({
      event: 'action.opened',
      occurredAt: NOW.toISOString(),
      app: { id: 'app_1', name: 'Budget', store: 'APP_STORE', country: 'us' },
      action: {
        id: 'act_1',
        rule: 'keyword.add_uncovered',
        category: 'metadata',
        priority: 'high',
        impact: 71,
        reopened: false,
      },
      keyword: { id: 'kw_1', text: 'budget planner' },
      link: null,
    });
  });

  it('marks a reopened action as reopened', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma());

    await notifier.notify([opened({ reopened: true })], NOW);

    expect(dispatched(alerts)[0].action.reopened).toBe(true);
  });

  it('withholds actions below the configured minimum priority', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma(), 'critical');

    expect(await notifier.notify([opened({ priority: 'high' })], NOW)).toBe(0);
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });

  it('emits every new action when the minimum is low', async () => {
    const { notifier } = notifierFor(buildPrisma(), 'low');

    expect(await notifier.notify([opened({ priority: 'low' })], NOW)).toBe(1);
  });

  it('never emits a localhost guess when the public url is unset', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma());

    await notifier.notify([opened()], NOW);

    expect(JSON.stringify(dispatched(alerts)[0])).not.toContain('localhost');
  });

  it('includes an absolute deep link when the public url is set', async () => {
    const { notifier, alerts } = notifierFor(
      buildPrisma(),
      'high',
      'https://aso.example.com/',
    );

    await notifier.notify([opened()], NOW);

    expect(dispatched(alerts)[0].link).toBe(
      'https://aso.example.com/actions?action=act_1',
    );
  });

  it('skips an action whose stored evidence no longer parses', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma('broken'));

    expect(await notifier.notify([opened()], NOW)).toBe(0);
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });

  it('refuses to dispatch outside a workspace scope', async () => {
    const { unscoped, alerts } = notifierFor(buildPrisma());

    await expect(unscoped.notify([opened()], NOW)).rejects.toThrow(
      'No workspace in scope for an action alert',
    );
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });

  it('refuses to dispatch an action owned by another workspace', async () => {
    const { notifier, alerts } = notifierFor(buildPrisma());

    await expect(
      notifier.notify([opened({ workspaceId: 'ws_other' })], NOW),
    ).rejects.toThrow('belongs to ws_other');
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });

  it('skips an action whose row disappeared mid-flight', async () => {
    const prisma = buildPrisma();
    prisma.actionItem.findMany = jest.fn(() => Promise.resolve([]));
    const { notifier, alerts } = notifierFor(prisma);

    expect(await notifier.notify([opened()], NOW)).toBe(0);
    expect(alerts.dispatch).not.toHaveBeenCalled();
  });
});

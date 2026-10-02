import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACTION_FORMULA_VERSION } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { ActionEventInput, ActionEventRecorder } from './action-events';
import { ActionTransitions } from './action-transitions';
import { ActionsService } from './actions.service';
import { BulkUpdateActionsDto } from './dto/bulk-update-actions.dto';
import { UpdateActionDto } from './dto/update-action.dto';

const WORKSPACE = 'ws_1';
const USER = 'user_1';

interface StoredAction {
  id: string;
  appId: string;
  status: string;
  priority: string;
  impact: number;
  reopenCount: number;
  snoozedUntil: Date | null;
  closedAt: Date | null;
  verifiedAt: Date | null;
  resolvedAt: Date | null;
  note: string | null;
}

interface StoredEvent {
  id: string;
  actionId: string;
  type: string;
  actor: string;
  userId?: string | null;
  status: string;
  reason?: string | null;
  occurredAt: Date;
}

type Data = Record<string, unknown>;

const yieldToOthers = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

class RowLocks {
  private readonly tails = new Map<string, Promise<void>>();

  async acquire(ids: readonly string[]): Promise<() => void> {
    const releases: Array<() => void> = [];
    for (const id of [...ids].sort()) {
      const previous = this.tails.get(id) ?? Promise.resolve();
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.tails.set(
        id,
        previous.then(() => held),
      );
      await previous;
      releases.push(release);
    }
    return () => releases.forEach((release) => release());
  }
}

function lockedIds(values: unknown[]): string[] {
  return values.flatMap((value) =>
    Array.isArray(value) ? value.map(String) : [String(value)],
  );
}

function apply(row: StoredAction, data: Data): void {
  for (const [key, value] of Object.entries(data)) {
    if (key === 'reopenCount' && typeof value === 'object' && value !== null) {
      const change = value as { increment?: number; decrement?: number };
      row.reopenCount += (change.increment ?? 0) - (change.decrement ?? 0);
    } else {
      (row as unknown as Data)[key] = value;
    }
  }
}

class ConcurrentActionDb {
  readonly events: StoredEvent[] = [];
  private readonly rows = new Map<string, StoredAction>();
  private readonly locks = new RowLocks();

  seed(overrides: Partial<StoredAction> = {}): StoredAction {
    const row: StoredAction = {
      id: 'act_1',
      appId: 'app_1',
      status: 'OPEN',
      priority: 'high',
      impact: 71,
      reopenCount: 0,
      snoozedUntil: null,
      closedAt: null,
      verifiedAt: null,
      resolvedAt: null,
      note: null,
      ...overrides,
    };
    this.rows.set(row.id, row);
    return row;
  }

  row(id = 'act_1'): StoredAction {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no action ${id}`);
    return row;
  }

  withTransaction<T>(run: (tx: unknown) => Promise<T>): Promise<T> {
    let release = () => {};
    const tx = {
      $queryRaw: async (
        _strings: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        release = await this.locks.acquire(lockedIds(values));
        return [];
      },
      actionItem: {
        findFirst: async (args: { where: { id: string } }) => {
          await yieldToOthers();
          const row = this.rows.get(args.where.id);
          return row ? { ...row } : null;
        },
        findMany: async (args: { where: { id: { in: string[] } } }) => {
          await yieldToOthers();
          return args.where.id.in.flatMap((id) => {
            const row = this.rows.get(id);
            return row ? [{ ...row }] : [];
          });
        },
        update: async (args: { where: { id: string }; data: Data }) => {
          await yieldToOthers();
          const row = this.row(args.where.id);
          apply(row, args.data);
          return this.toRow(row);
        },
      },
      actionEvent: {
        createMany: async (args: { data: ActionEventInput[] }) => {
          await yieldToOthers();
          this.events.push(
            ...args.data.map((event, index) => ({
              ...event,
              id: `ev_${this.events.length + index}`,
            })),
          );
          return { count: args.data.length };
        },
        findFirst: async (args: {
          where: { actionId: string; type: string };
        }) => {
          await yieldToOthers();
          return (
            this.events
              .filter(
                (event) =>
                  event.actionId === args.where.actionId &&
                  event.type === args.where.type,
              )
              .sort(
                (left, right) =>
                  right.occurredAt.getTime() - left.occurredAt.getTime(),
              )[0] ?? null
          );
        },
        findMany: async (args: {
          where: { actionId: string };
          take: number;
        }) => {
          await yieldToOthers();
          return this.events
            .filter((event) => event.actionId === args.where.actionId)
            .sort(
              (left, right) =>
                right.occurredAt.getTime() - left.occurredAt.getTime(),
            )
            .slice(0, args.take);
        },
        delete: async (args: { where: { id: string } }) => {
          await yieldToOthers();
          const index = this.events.findIndex(
            (event) => event.id === args.where.id,
          );
          if (index < 0) throw new Error('Record to delete does not exist');
          this.events.splice(index, 1);
          return {};
        },
      },
    };
    return run(tx).finally(() => release());
  }

  private toRow(row: StoredAction) {
    return {
      ...row,
      rule: 'keyword.add_uncovered',
      category: 'metadata',
      formulaVersion: ACTION_FORMULA_VERSION,
      country: 'us',
      store: 'APP_STORE',
      evidence: { rule: 'keyword.add_uncovered' },
      firstSeenAt: new Date('2026-07-20T03:00:00.000Z'),
      lastSeenAt: new Date('2026-07-30T03:00:00.000Z'),
      aiExplanation: null,
      aiModel: null,
      aiGeneratedAt: null,
      app: { id: row.appId, name: 'Budget' },
      keyword: null,
    };
  }
}

const serviceFor = (db: ConcurrentActionDb): ActionsService => {
  const workspace = new WorkspaceContext();
  const service = new ActionsService(
    db as unknown as PrismaService,
    {} as FailFastRedis,
    workspace,
    new ActionTransitions(
      { get: () => 90 } as unknown as ConfigService<Env, true>,
      workspace,
      new ActionEventRecorder(),
    ),
  );
  return new Proxy(service, {
    get: (target, property, receiver) => {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) =>
        workspace.run(WORKSPACE, () =>
          Promise.resolve(
            (value as (...inner: unknown[]) => unknown).apply(target, args),
          ),
        );
    },
  });
};

const update = (body: Partial<UpdateActionDto>) =>
  Object.assign(new UpdateActionDto(), body);

const bulk = (ids: string[], body: Partial<BulkUpdateActionsDto>) =>
  Object.assign(new BulkUpdateActionsDto(), { ids, ...body });

const typesOf = (db: ConcurrentActionDb): string[] =>
  db.events.map((event) => event.type);

describe('ActionsService concurrent transitions', () => {
  it('records one done event when a person double clicks done', async () => {
    const db = new ConcurrentActionDb();
    db.seed();
    const service = serviceFor(db);

    const [first, second] = await Promise.all([
      service.update('act_1', update({ status: 'DONE' }), USER),
      service.update('act_1', update({ status: 'DONE' }), USER),
    ]);

    expect(typesOf(db)).toEqual(['done']);
    expect(first.status).toBe('DONE');
    expect(second.status).toBe('DONE');
  });

  it('counts one reopen for three simultaneous reopens', async () => {
    const db = new ConcurrentActionDb();
    db.seed({ status: 'DONE', closedAt: new Date() });
    const service = serviceFor(db);

    await Promise.all(
      [1, 2, 3].map(() =>
        service.update('act_1', update({ status: 'OPEN' }), USER),
      ),
    );

    expect(typesOf(db)).toEqual(['reopened']);
    expect(db.row().reopenCount).toBe(1);
  });

  it('records one event per action when a bulk close is sent twice', async () => {
    const db = new ConcurrentActionDb();
    db.seed({ id: 'act_1' });
    db.seed({ id: 'act_2' });
    const service = serviceFor(db);

    await Promise.all([
      service.bulkUpdate(bulk(['act_1', 'act_2'], { status: 'DONE' }), USER),
      service.bulkUpdate(bulk(['act_2', 'act_1'], { status: 'DONE' }), USER),
    ]);

    expect(
      db.events.map((event) => [event.actionId, event.type]).sort(),
    ).toEqual([
      ['act_1', 'done'],
      ['act_2', 'done'],
    ]);
  });

  it('keeps both decisions when two people choose different outcomes', async () => {
    const db = new ConcurrentActionDb();
    db.seed();
    const service = serviceFor(db);

    await Promise.all([
      service.update('act_1', update({ status: 'DONE' }), USER),
      service.update('act_1', update({ status: 'DISMISSED' }), 'user_2'),
    ]);

    expect(typesOf(db).sort()).toEqual(['dismissed', 'done']);
  });

  it('undoes once when undo is clicked twice', async () => {
    const db = new ConcurrentActionDb();
    db.seed({ status: 'OPEN', reopenCount: 1 });
    db.events.push(
      {
        id: 'ev_done',
        actionId: 'act_1',
        type: 'done',
        actor: 'user',
        userId: USER,
        status: 'DONE',
        occurredAt: new Date(Date.now() - 20 * 60_000),
      },
      {
        id: 'ev_reopened',
        actionId: 'act_1',
        type: 'reopened',
        actor: 'user',
        userId: USER,
        status: 'OPEN',
        occurredAt: new Date(Date.now() - 60_000),
      },
    );
    const service = serviceFor(db);

    const results = await Promise.allSettled([
      service.update('act_1', update({ status: 'DONE', revert: true }), USER),
      service.update('act_1', update({ status: 'DONE', revert: true }), USER),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(db.row().reopenCount).toBe(0);
    expect(db.row().status).toBe('DONE');
  });

  it('records one dismissal when a dismiss with a reason is sent twice', async () => {
    const db = new ConcurrentActionDb();
    db.seed();
    const service = serviceFor(db);

    await Promise.all(
      [1, 2].map(() =>
        service.update(
          'act_1',
          update({ status: 'DISMISSED', reason: 'not_relevant' }),
          USER,
        ),
      ),
    );

    expect(typesOf(db)).toEqual(['dismissed']);
  });

  it('ignores a dismissal that repeats the reason already recorded', async () => {
    const db = new ConcurrentActionDb();
    db.seed();
    const service = serviceFor(db);
    const dismiss = () =>
      service.update(
        'act_1',
        update({ status: 'DISMISSED', reason: 'not_relevant' }),
        USER,
      );

    await dismiss();
    await dismiss();

    expect(typesOf(db)).toEqual(['dismissed']);
  });

  it('records a dismissal that gives a different reason', async () => {
    const db = new ConcurrentActionDb();
    db.seed();
    const service = serviceFor(db);

    await service.update(
      'act_1',
      update({ status: 'DISMISSED', reason: 'not_relevant' }),
      USER,
    );
    await service.update(
      'act_1',
      update({ status: 'DISMISSED', reason: 'handled_elsewhere' }),
      USER,
    );

    expect(db.events.map((event) => event.reason)).toEqual([
      'not_relevant',
      'handled_elsewhere',
    ]);
  });
});

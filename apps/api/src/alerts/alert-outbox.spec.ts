import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { AlertOutbox } from './alert-outbox';
import { appDelisted } from './listing-events.fixture';

const sqlOf = (call: unknown[]): string =>
  (call[0] as TemplateStringsArray).join('?');

const buildTx = (inserted: { id: string }[] = [{ id: 'ev1' }]) => {
  const statements: string[] = [];
  const executeRaw = jest.fn((strings: TemplateStringsArray) => {
    statements.push(strings.join('?'));
    return Promise.resolve(0);
  });
  const createManyAndReturn = jest.fn(() => {
    statements.push('insert');
    return Promise.resolve(inserted);
  });
  const createMany = jest.fn(() => {
    statements.push('relay');
    return Promise.resolve({ count: inserted.length });
  });
  const tx = {
    $executeRaw: executeRaw,
    alertEvent: { createManyAndReturn },
    alertRelay: { createMany },
  };
  return {
    tx: tx as unknown as Prisma.TransactionClient,
    statements,
    executeRaw,
    createManyAndReturn,
    createMany,
  };
};

const buildOutbox = (delivery: 'batched' | 'instant') => {
  const workspace = new WorkspaceContext();
  const outbox = new AlertOutbox(
    { get: jest.fn(() => delivery) } as unknown as ConfigService<Env, true>,
    workspace,
  );
  const scoped = <T>(work: () => Promise<T>) =>
    workspace.run(DEFAULT_WORKSPACE_ID, work);
  return { outbox, scoped };
};

describe('AlertOutbox.record', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockReturnValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes an unsettled row and no relay in batched mode', async () => {
    const { tx, statements, createManyAndReturn, createMany } = buildTx();
    const { outbox, scoped } = buildOutbox('batched');
    const payload = appDelisted();

    await scoped(() =>
      outbox.record(tx, 'the loss', () => Promise.resolve(payload)),
    );

    expect(createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          event: 'app.delisted',
          appId: 'a',
          keywordId: null,
          dedupeKey: `delisted:a:${payload.occurredAt}`,
          payload,
          flushedAt: null,
        },
      ],
      skipDuplicates: true,
      select: { id: true },
    });
    expect(createMany).not.toHaveBeenCalled();
    expect(statements).toEqual([
      'SAVEPOINT alert_outbox',
      'insert',
      'RELEASE SAVEPOINT alert_outbox',
    ]);
  });

  it('writes a settled row and one relay per inserted row in instant mode', async () => {
    const { tx, statements, createManyAndReturn, createMany } = buildTx([
      { id: 'ev1' },
    ]);
    const { outbox, scoped } = buildOutbox('instant');

    await scoped(() =>
      outbox.record(tx, 'the loss', () => Promise.resolve(appDelisted())),
    );

    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ flushedAt: expect.any(Date) as Date }),
        ],
      }),
    );
    expect(createMany).toHaveBeenCalledWith({
      data: [{ alertEventId: 'ev1', workspaceId: DEFAULT_WORKSPACE_ID }],
    });
    expect(statements).toEqual([
      'SAVEPOINT alert_outbox',
      'insert',
      'relay',
      'RELEASE SAVEPOINT alert_outbox',
    ]);
  });

  it('relays nothing when the row already existed', async () => {
    const { tx, createMany } = buildTx([]);
    const { outbox, scoped } = buildOutbox('instant');

    await scoped(() =>
      outbox.record(tx, 'the loss', () => Promise.resolve(appDelisted())),
    );

    expect(createMany).not.toHaveBeenCalled();
  });

  it('writes nothing when the build answers null and still releases the savepoint', async () => {
    const { tx, statements, createManyAndReturn } = buildTx();
    const { outbox, scoped } = buildOutbox('instant');

    await scoped(() =>
      outbox.record(tx, 'the loss', () => Promise.resolve(null)),
    );

    expect(createManyAndReturn).not.toHaveBeenCalled();
    expect(statements).toEqual([
      'SAVEPOINT alert_outbox',
      'RELEASE SAVEPOINT alert_outbox',
    ]);
  });

  it('rolls back to the savepoint and logs when the build throws', async () => {
    const { tx, statements, createManyAndReturn } = buildTx();
    const { outbox, scoped } = buildOutbox('instant');

    await expect(
      scoped(() =>
        outbox.record(tx, 'the loss of app a', () =>
          Promise.reject(new Error('history unreadable')),
        ),
      ),
    ).resolves.toBeUndefined();

    expect(createManyAndReturn).not.toHaveBeenCalled();
    expect(statements).toEqual([
      'SAVEPOINT alert_outbox',
      'ROLLBACK TO SAVEPOINT alert_outbox',
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      'the alert of the loss of app a was not recorded: history unreadable',
    );
  });

  it('rolls back to the savepoint and logs when the insert throws', async () => {
    const { tx, statements, createManyAndReturn } = buildTx();
    createManyAndReturn.mockImplementation(() =>
      Promise.reject(new Error('insert refused')),
    );
    const { outbox, scoped } = buildOutbox('batched');

    await scoped(() =>
      outbox.record(tx, 'the loss', () => Promise.resolve(appDelisted())),
    );

    expect(statements).toEqual([
      'SAVEPOINT alert_outbox',
      'ROLLBACK TO SAVEPOINT alert_outbox',
    ]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('insert refused'),
    );
  });

  it('propagates when the rollback itself fails', async () => {
    const { tx, executeRaw } = buildTx();
    executeRaw.mockImplementation((strings: TemplateStringsArray) =>
      strings.join('?').startsWith('ROLLBACK')
        ? Promise.reject(new Error('connection lost'))
        : Promise.resolve(0),
    );
    const { outbox, scoped } = buildOutbox('batched');

    await expect(
      scoped(() =>
        outbox.record(tx, 'the loss', () =>
          Promise.reject(new Error('history unreadable')),
        ),
      ),
    ).rejects.toThrow('connection lost');
  });

  it('refuses to write outside a workspace scope', async () => {
    const { tx, executeRaw, createManyAndReturn } = buildTx();
    const { outbox } = buildOutbox('instant');

    await outbox.record(tx, 'the loss', () => Promise.resolve(appDelisted()));

    expect(createManyAndReturn).not.toHaveBeenCalled();
    expect(executeRaw.mock.calls.map(sqlOf)).toEqual([
      'SAVEPOINT alert_outbox',
      'ROLLBACK TO SAVEPOINT alert_outbox',
    ]);
    expect(error).toHaveBeenCalledTimes(1);
  });
});

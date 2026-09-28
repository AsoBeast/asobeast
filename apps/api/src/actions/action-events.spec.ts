import { Prisma } from '@prisma/client';
import { ActionEventInput, ActionEventRecorder } from './action-events';

const event: ActionEventInput = {
  workspaceId: 'ws_1',
  actionId: 'act_1',
  appId: 'app_1',
  type: 'opened',
  actor: 'system',
  userId: null,
  status: 'OPEN',
  priority: 'high',
  impact: 71,
  snoozedUntil: null,
  reason: null,
  occurredAt: new Date('2026-07-30T03:00:00.000Z'),
};

const transaction = () => {
  const createMany = jest.fn(() => Promise.resolve({ count: 1 }));
  return {
    createMany,
    tx: { actionEvent: { createMany } } as unknown as Prisma.TransactionClient,
  };
};

describe('ActionEventRecorder', () => {
  it('runs no query when there is nothing to record', async () => {
    const { tx, createMany } = transaction();

    await new ActionEventRecorder().record(tx, []);

    expect(createMany).not.toHaveBeenCalled();
  });

  it('writes every event in one statement', async () => {
    const { tx, createMany } = transaction();
    const done: ActionEventInput = { ...event, type: 'done', actor: 'user' };

    await new ActionEventRecorder().record(tx, [event, done]);

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({ data: [event, done] });
  });
});

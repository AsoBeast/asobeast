import './helpers/enable-billing';
import { ApiErrorEnvelope, PLAN_LIMITS } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { onDemandSpent, spendOnDemandAllowance } from './obliterate-queues';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const SCORE_LIMIT = PLAN_LIMITS.indie.onDemand?.score.limit ?? 0;

describe('Keyword inspection capacity (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;

  const inspect = (keyword: string) =>
    owner
      .post('/keyword-inspections')
      .send({ keyword, store: 'APP_STORE', country: 'us' });

  const spendAll = async () => {
    await inspect('first phrase').expect(202);
    expect(await spendOnDemandAllowance(harness.app, SCORE_LIMIT)).toBe(1);
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
  });

  afterAll(() => stopCapacityHarness(harness));

  it('refuses an inspection once the score allowance is spent and names the action', async () => {
    await spendAll();

    const refused = await inspect('one too many').expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'day',
      rateClass: 'store',
      plan: 'indie',
      limit: SCORE_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'score',
    });
    expect(
      await harness.prisma.keywordInspection.count({
        where: { keyword: { text: 'one too many' } },
      }),
    ).toBe(0);
  });

  it('spends nothing on a repeat of a pending inspection', async () => {
    const first = await inspect('habit tracker').expect(202);
    const [repeat, calls] = await allowanceSpendsDuring(harness, () =>
      inspect('Habit Tracker').expect(202),
    );

    expect(calls).toBe(0);
    expect((repeat.body as { id: string }).id).toBe(
      (first.body as { id: string }).id,
    );
  });

  it('spends once when the same keyword is requested at once', async () => {
    const [answers, calls] = await allowanceSpendsDuring(harness, () =>
      Promise.all([inspect('habit tracker'), inspect('habit tracker')]),
    );

    expect(answers.map((answer) => answer.status)).toEqual([202, 202]);
    expect(calls).toBe(1);
    expect(await harness.prisma.keywordInspection.count()).toBe(1);
  });

  it('spends nothing on a request the validation refuses', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      owner
        .post('/keyword-inspections')
        .send({ keyword: '', store: 'APP_STORE', country: 'us' })
        .expect(400),
    );

    expect(calls).toBe(0);
    expect(await harness.prisma.keywordInspection.count()).toBe(0);
  });

  it('gives the allowance back when the queue refuses the inspection', async () => {
    await inspect('first phrase').expect(202);
    const add = jest
      .spyOn(Queue.prototype, 'add')
      .mockRejectedValueOnce(new Error('queue down'));
    try {
      await inspect('queue refused').expect(500);
    } finally {
      add.mockRestore();
    }

    expect(await onDemandSpent(harness.app)).toBe(1);
  });
});

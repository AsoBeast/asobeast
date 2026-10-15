import './helpers/enable-billing';
import { ApiErrorEnvelope, ChartPage, PLAN_LIMITS } from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';

const CAPTURE_LIMIT = PLAN_LIMITS.indie.onDemand?.chartCapture.limit ?? 0;
const KEY = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

describe('Chart capture capacity (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;

  const capture = (genre = KEY.genre) =>
    owner.post('/charts/capture').send({ ...KEY, genre });

  const spendCaptureAllowance = () =>
    harness.app.get(WorkspaceContext).run(DEFAULT_WORKSPACE_ID, async () => {
      const limiter = harness.app.get(OnDemandLimiter);
      for (let used = 0; used < CAPTURE_LIMIT; used += 1) {
        await limiter.consume('chartCapture');
      }
    });

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ChartCapture" CASCADE',
    );
    owner = await resetCapacity(harness);
  });

  afterAll(() => stopCapacityHarness(harness));

  it('spends one allowance for a capture that reached the store', async () => {
    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      capture().expect(200),
    );

    expect((answer.body as ChartPage).entries).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('spends nothing for a chart already captured today', async () => {
    await capture().expect(200);

    const [, calls] = await allowanceSpendsDuring(harness, () =>
      capture().expect(200),
    );

    expect(calls).toBe(0);
  });

  it('spends nothing when the key is refused', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      capture('9999').expect(400),
    );

    expect(calls).toBe(0);
  });

  it('refuses a capture once the allowance is spent and names the action', async () => {
    await spendCaptureAllowance();

    const refused = await capture('6007').expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toMatchObject({
      rateClass: 'store',
      window: 'day',
      plan: 'indie',
      limit: CAPTURE_LIMIT,
      action: 'chartCapture',
    });
    expect(envelope.message).toMatch(
      /^Chart capture limit reached: the indie plan allows \d+ requests per day\./,
    );
    expect(refused.headers['retry-after']).toBeDefined();
    await expect(harness.prisma.chartCapture.count()).resolves.toBe(0);
  });
});

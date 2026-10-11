import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  CompetitorItem,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { RIVAL_URL } from './helpers/mcp-fixtures';
import { clearRateLimitCounters } from './obliterate-queues';

const COMPETITOR_LIMIT = PLAN_LIMITS.indie.onDemand?.addCompetitor.limit ?? 0;
const ROOM = PLAN_LIMITS.indie.competitorsPerApp ?? 0;

describe('Competitor capacity (e2e)', () => {
  jest.setTimeout(120_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let primaryId: string;

  const addCompetitor = () =>
    owner.post(`/apps/${primaryId}/competitors`).send({ url: RIVAL_URL });

  const addAndRemove = async () => {
    await clearRateLimitCounters(harness.app);
    const added = await addCompetitor().expect(201);
    await owner
      .delete(
        `/apps/${primaryId}/competitors/${(added.body as CompetitorItem).id}`,
      )
      .expect(204);
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    primaryId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '555000111',
          country: 'us',
          name: 'Primary',
        },
      })
    ).id;
  });

  afterAll(() => stopCapacityHarness(harness));

  it('refuses a competitor once the plan allowance is spent, however often one is removed in between', async () => {
    for (let added = 0; added < COMPETITOR_LIMIT; added += 1) {
      await addAndRemove();
    }

    await clearRateLimitCounters(harness.app);
    const refused = await addCompetitor().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'day',
      rateClass: 'store',
      plan: 'indie',
      limit: COMPETITOR_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'addCompetitor',
    });
    expect(envelope.message).toMatch(
      /^Add competitor limit reached: the indie plan allows \d+ requests per day\./,
    );
    expect(
      await harness.prisma.app.count({ where: { isCompetitor: true } }),
    ).toBe(0);
  });

  it('spends nothing on a competitor the app already has', async () => {
    await addCompetitor().expect(201);
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    await addCompetitor().expect(201);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
  });

  it('spends nothing on a competitor the plan has no room for', async () => {
    await harness.prisma.app.createMany({
      data: Array.from({ length: ROOM }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `77700${index}`,
        country: 'us',
        isCompetitor: true,
        primaryAppId: primaryId,
      })),
    });
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    await addCompetitor().expect(403);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
  });
});

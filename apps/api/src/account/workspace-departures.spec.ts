import { departureOf, type DepartingWorkspace } from './workspace-departures';

const NOW = new Date('2026-11-15T22:30:00.000Z');

const WORKSPACE: DepartingWorkspace = {
  plan: 'free',
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionId: 'sub_1',
  subscriptionStatus: 'canceled',
  trialStartedAt: new Date('2026-10-01T10:00:00.000Z'),
  firstPaidAt: new Date('2026-10-08T10:00:00.000Z'),
  createdAt: new Date('2026-09-30T23:59:59.000Z'),
  deletionRequestedAt: new Date('2026-11-08T08:15:00.000Z'),
  deletionReason: 'switched-tool',
  deletionStage: 'paying',
  deletionPlan: 'ultimate',
};

const SIZES = { apps: 2, keywordMarkets: 31, members: 3 };
const NOW_STANDING = { stage: 'churned', plan: 'free' } as const;

describe('departureOf', () => {
  it('keeps the stage and plan the workspace had when it asked to leave', () => {
    expect(departureOf(WORKSPACE, SIZES, NOW_STANDING, NOW)).toEqual({
      erasedOn: new Date('2026-11-15T00:00:00.000Z'),
      createdOn: new Date('2026-09-30T00:00:00.000Z'),
      requestedOn: new Date('2026-11-08T00:00:00.000Z'),
      stage: 'paying',
      plan: 'ultimate',
      everPaid: true,
      apps: 2,
      keywordMarkets: 31,
      members: 3,
      reason: 'switched-tool',
    });
  });

  it('falls back to the standing at erasure for a request made before it was kept', () => {
    const departure = departureOf(
      {
        ...WORKSPACE,
        deletionStage: null,
        deletionPlan: null,
        deletionReason: null,
      },
      SIZES,
      NOW_STANDING,
      NOW,
    );

    expect(departure).toMatchObject({
      stage: 'churned',
      plan: 'free',
      reason: null,
    });
  });

  it('drops a stored value outside the fixed lists', () => {
    expect(
      departureOf(
        {
          ...WORKSPACE,
          deletionStage: 'gone',
          deletionReason: 'my name is Ana',
        },
        SIZES,
        NOW_STANDING,
        NOW,
      ),
    ).toMatchObject({ stage: 'churned', plan: 'free', reason: null });
  });

  it('carries nothing that names the workspace or a person', () => {
    const keys = Object.keys(departureOf(WORKSPACE, SIZES, NOW_STANDING, NOW));

    expect(keys.sort()).toEqual(
      [
        'apps',
        'createdOn',
        'erasedOn',
        'everPaid',
        'keywordMarkets',
        'members',
        'plan',
        'reason',
        'requestedOn',
        'stage',
      ].sort(),
    );
  });
});

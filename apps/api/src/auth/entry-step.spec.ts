import {
  entryStepOf,
  heldPlanOf,
  type EntryCandidate,
  type HeldPlanSource,
} from './entry-step';

const candidate = (over: Partial<EntryCandidate> = {}): EntryCandidate => ({
  billing: true,
  verificationRequired: true,
  emailVerified: false,
  role: 'owner',
  entitled: false,
  heldPlan: false,
  ...over,
});

const NEVER_HELD: HeldPlanSource = {
  subscriptionId: null,
  trialStartedAt: null,
  trialEndsAt: null,
  planExpiresAt: null,
};

describe('entryStepOf', () => {
  it('owes nothing on an instance without billing', () => {
    expect(entryStepOf(candidate({ billing: false }))).toBeUndefined();
  });

  it('owes nothing for an entitled owner, confirmed or not', () => {
    expect(entryStepOf(candidate({ entitled: true }))).toBeUndefined();
  });

  it('never sends a member anywhere', () => {
    expect(entryStepOf(candidate({ role: 'member' }))).toBeUndefined();
  });

  it('asks a new unconfirmed owner to confirm the address first', () => {
    expect(entryStepOf(candidate())).toBe('confirm-email');
  });

  it('asks for a plan when the instance sends no confirmation mail', () => {
    expect(entryStepOf(candidate({ verificationRequired: false }))).toBe(
      'choose-plan',
    );
  });

  it('asks a confirmed owner who never held a plan to choose one', () => {
    expect(entryStepOf(candidate({ emailVerified: true }))).toBe('choose-plan');
  });

  it('owes nothing for a workspace that ever held a plan', () => {
    expect(
      entryStepOf(candidate({ emailVerified: true, heldPlan: true })),
    ).toBeUndefined();
  });

  it('never asks a workspace that held a plan to confirm the address', () => {
    expect(entryStepOf(candidate({ heldPlan: true }))).toBeUndefined();
  });
});

describe('heldPlanOf', () => {
  it('answers false for a workspace that never held anything', () => {
    expect(heldPlanOf(NEVER_HELD)).toBe(false);
  });

  it.each([
    ['subscriptionId', 'sub_1'],
    ['trialStartedAt', new Date('2026-10-01T00:00:00.000Z')],
    ['trialEndsAt', new Date('2026-10-08T00:00:00.000Z')],
    ['planExpiresAt', new Date('2026-11-01T00:00:00.000Z')],
  ] as const)('answers true when %s alone is set', (field, value) => {
    expect(heldPlanOf({ ...NEVER_HELD, [field]: value })).toBe(true);
  });
});

import './helpers/enable-billing';
import './helpers/enable-stripe';
import type { BillingReconcileReport } from '@asobeast/shared';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  workspaceRow,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';
import { checkoutSession, subscriptionFrom } from './helpers/fake-stripe';

const RECONCILE = '/billing/reconcile';
const CUSTOMER = 'cus_test_stored';

describe('Billing reconcile (e2e)', () => {
  let harness: BillingHarness;

  const reconcile = () => harness.owner.post(RECONCILE);

  beforeAll(async () => {
    harness = await startBillingHarness();
  }, 60_000);

  beforeEach(() => resetBillingState(harness));

  afterAll(() => stopBillingHarness(harness));

  it('agrees with stripe about a free workspace', async () => {
    const response = await reconcile().expect(200);

    const expected: BillingReconcileReport = {
      checked: 1,
      corrected: 0,
      orphanSubscriptions: [],
      unreconciled: [],
    };
    expect(response.body as BillingReconcileReport).toEqual(expected);
  });

  it('adopts a subscription stripe holds that no webhook recorded', async () => {
    await resetBillingState(harness, { billingCustomerId: CUSTOMER });
    harness.fake.subscriptionStore.set(
      'sub_adopt',
      subscriptionFrom({
        id: 'sub_adopt',
        status: 'active',
        customer: CUSTOMER,
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      }),
    );

    const response = await reconcile().expect(200);

    expect((response.body as BillingReconcileReport).corrected).toBe(1);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      plan: 'indie',
      subscriptionId: 'sub_adopt',
      subscriptionStatus: 'active',
    });
  });

  it('revokes a plan stripe cannot back, ten times an hour', async () => {
    await resetBillingState(harness, {
      plan: 'indie',
      subscriptionId: 'sub_gone',
      subscriptionStatus: 'active',
    });

    await reconcile().expect(200);

    await expect(workspaceRow(harness)).resolves.toMatchObject({
      plan: 'free',
      subscriptionId: null,
    });
    for (let attempt = 2; attempt <= 10; attempt += 1) {
      await reconcile().expect(200);
    }
    await reconcile().expect(429);
  });

  it('converges from the checkout session the customer returned with', async () => {
    await resetBillingState(harness, { billingCustomerId: CUSTOMER });
    harness.fake.sessions.set(
      'cs_test_done',
      checkoutSession({
        id: 'cs_test_done',
        status: 'complete',
        client_reference_id: WORKSPACE,
        subscription: 'sub_done',
      }),
    );
    harness.fake.subscriptionStore.set(
      'sub_done',
      subscriptionFrom({
        id: 'sub_done',
        status: 'active',
        customer: CUSTOMER,
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      }),
    );

    await reconcile().send({ sessionId: 'cs_test_done' }).expect(200);

    await expect(workspaceRow(harness)).resolves.toMatchObject({
      plan: 'indie',
      subscriptionId: 'sub_done',
    });
  });

  it('refuses a session id that is not one', async () => {
    await reconcile().send({ sessionId: 'nope' }).expect(400);
    await reconcile().send({ sessionId: 'cs_forged' }).expect(400);
    await reconcile()
      .send({ sessionId: 'cs_test_a1\n[Nest] LOG forged line' })
      .expect(400);
    await reconcile().send({ sessionId: 42 }).expect(400);
    await reconcile().send({}).expect(200);
  });
});

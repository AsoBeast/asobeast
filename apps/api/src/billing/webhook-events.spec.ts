import type Stripe from 'stripe';
import {
  HANDLED_EVENTS,
  isHandled,
  subscriptionIdOf,
  workspaceIdOf,
} from './webhook-events';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

const eventOf = (type: string, object: unknown): Stripe.Event =>
  ({ id: 'evt_1', type, created: 1, data: { object } }) as Stripe.Event;

describe('isHandled', () => {
  it('accepts every event the billing system acts on', () => {
    expect(HANDLED_EVENTS.every(isHandled)).toBe(true);
  });

  it('ignores an event type Stripe added after this release', () => {
    expect(isHandled('customer.discount.created')).toBe(false);
  });
});

describe('subscriptionIdOf', () => {
  it('reads the id of a subscription event directly', () => {
    expect(
      subscriptionIdOf(
        eventOf('customer.subscription.updated', { id: 'sub_1' }),
      ),
    ).toBe('sub_1');
  });

  it('reads the subscription an invoice belongs to', () => {
    expect(
      subscriptionIdOf(eventOf('invoice.paid', { subscription: 'sub_2' })),
    ).toBe('sub_2');
  });

  it('reads the subscription a checkout session created', () => {
    expect(
      subscriptionIdOf(
        eventOf('checkout.session.completed', { subscription: 'sub_3' }),
      ),
    ).toBe('sub_3');
  });

  it('reads the subscription from an invoice parent', () => {
    expect(
      subscriptionIdOf(
        eventOf('invoice.paid', {
          parent: { subscription_details: { subscription: 'sub_4' } },
        }),
      ),
    ).toBe('sub_4');
  });

  it('answers null when the event names no subscription', () => {
    expect(subscriptionIdOf(eventOf('invoice.paid', {}))).toBeNull();
  });
});

describe('workspaceIdOf', () => {
  it('prefers the client reference a checkout session carries', () => {
    expect(
      workspaceIdOf(
        eventOf('checkout.session.completed', { client_reference_id: 'ws_1' }),
        WORKSPACE_METADATA_KEY,
      ),
    ).toBe('ws_1');
  });

  it('falls back to the metadata a subscription carries', () => {
    expect(
      workspaceIdOf(
        eventOf('customer.subscription.updated', {
          metadata: { [WORKSPACE_METADATA_KEY]: 'ws_2' },
        }),
        WORKSPACE_METADATA_KEY,
      ),
    ).toBe('ws_2');
  });

  it('answers null when neither is present', () => {
    expect(
      workspaceIdOf(eventOf('invoice.paid', {}), WORKSPACE_METADATA_KEY),
    ).toBeNull();
  });
});

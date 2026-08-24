import type Stripe from 'stripe';

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

const HANDLED = new Set<string>(HANDLED_EVENTS);

export function isHandled(type: string): type is HandledEvent {
  return HANDLED.has(type);
}

function objectOf(event: Stripe.Event): Record<string, unknown> {
  return event.data.object as unknown as Record<string, unknown>;
}

export function subscriptionIdOf(event: Stripe.Event): string | null {
  const object = objectOf(event);
  if (event.type.startsWith('customer.subscription.')) {
    return typeof object.id === 'string' ? object.id : null;
  }
  const subscription = object.subscription ?? object.parent;
  if (typeof subscription === 'string') return subscription;
  if (subscription && typeof subscription === 'object') {
    const nested = subscription as Record<string, unknown>;
    const details = nested.subscription_details as
      Record<string, unknown> | undefined;
    const id = details?.subscription ?? nested.id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

export function workspaceIdOf(
  event: Stripe.Event,
  metadataKey: string,
): string | null {
  const object = objectOf(event);
  if (typeof object.client_reference_id === 'string') {
    return object.client_reference_id;
  }
  const metadata = object.metadata as Record<string, string> | undefined;
  return metadata?.[metadataKey] ?? null;
}

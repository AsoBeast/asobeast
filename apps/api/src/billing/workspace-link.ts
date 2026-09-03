import type Stripe from 'stripe';

export const WORKSPACE_METADATA_KEY = 'asobeast_workspace_id';

type StripeMetadata = Pick<Stripe.Subscription, 'metadata'>;

export function workspaceNamedBy(object: StripeMetadata): string | null {
  return object.metadata[WORKSPACE_METADATA_KEY] ?? null;
}

export function belongsToWorkspace(
  object: StripeMetadata,
  workspaceId: string,
): boolean {
  const named = workspaceNamedBy(object);
  return named === null || named === workspaceId;
}

import type Stripe from 'stripe';

export const WORKSPACE_METADATA_KEY = 'asobeast_workspace_id';

interface StripeObject {
  metadata?: Stripe.Metadata | null;
}

export function workspaceNamedBy(object: StripeObject): string | null {
  return object.metadata?.[WORKSPACE_METADATA_KEY] ?? null;
}

export function belongsToWorkspace(
  object: StripeObject,
  workspaceId: string,
): boolean {
  const named = workspaceNamedBy(object);
  return named === null || named === workspaceId;
}

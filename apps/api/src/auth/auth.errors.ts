import type { EntitlementDetail } from '@asobeast/shared';

export class EntitlementRequiredError extends Error {
  constructor(readonly detail: EntitlementDetail) {
    super(reasonFor(detail));
    this.name = 'EntitlementRequiredError';
  }
}

function reasonFor(detail: EntitlementDetail): string {
  if (detail.planExpiresAt !== null) {
    return 'Your subscription ended — renew to keep using asobeast';
  }
  if (detail.trialEndsAt !== null) {
    return 'Trial expired — upgrade to keep using asobeast';
  }
  return 'Choose a plan to start using asobeast';
}

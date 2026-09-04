import {
  BILLING_RECOVERY,
  type BillingConflictDetail,
  type BillingConflictReason,
} from '@asobeast/shared';

export class BillingConflictError extends Error {
  readonly detail: BillingConflictDetail;

  constructor(reason: BillingConflictReason, message: string) {
    super(message);
    this.name = 'BillingConflictError';
    this.detail = { reason, recovery: BILLING_RECOVERY[reason] };
  }
}

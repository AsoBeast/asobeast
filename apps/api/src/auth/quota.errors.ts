import { QuotaDetail } from '@asobeast/shared';

export class QuotaExceededError extends Error {
  constructor(readonly detail: QuotaDetail) {
    super(
      `${detail.resource} limit reached: ${detail.used} of ${detail.limit} used on the ${detail.plan} plan, ${detail.requested} more requested`,
    );
    this.name = 'QuotaExceededError';
  }
}

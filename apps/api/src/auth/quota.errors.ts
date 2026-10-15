import { QuotaDetail, QuotaResource } from '@asobeast/shared';

const QUOTA_LABELS: Record<QuotaResource, string> = {
  apps: 'Apps',
  keywordMarkets: 'Keyword markets',
  competitors: 'Competitors',
  chartFollows: 'Followed charts',
};

export class QuotaExceededError extends Error {
  constructor(readonly detail: QuotaDetail) {
    super(
      `${QUOTA_LABELS[detail.resource]} limit reached: ${detail.used} of ${detail.limit} used on the ${detail.plan} plan, ${detail.requested} more requested`,
    );
    this.name = 'QuotaExceededError';
  }
}

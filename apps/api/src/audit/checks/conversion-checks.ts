import {
  aiCheck,
  AuditContext,
  check,
  DAY_MS,
  FRESH_DAYS,
  RubricCheck,
} from '../audit-scoring';

export const conversionChecks = (context: AuditContext): RubricCheck[] => {
  const hasNotes = Boolean(context.rawFacts.releaseNotes);
  const fresh =
    context.storeUpdatedAt !== null &&
    context.now.getTime() - context.storeUpdatedAt.getTime() <=
      FRESH_DAYS * DAY_MS;
  return [
    check({
      id: 'conversion-freshness',
      label: "What's New freshness",
      source: 'store',
      weight: 2,
      score: (hasNotes ? 5 : 0) + (fresh ? 5 : 0),
      detail: `Release notes ${hasNotes ? 'present' : 'missing'}, updated ${
        fresh ? 'recently' : 'over 30 days ago'
      }.`,
    }),
    aiCheck('conversion-promo', 'Promotional text', 1, context.aiChecks),
    aiCheck('conversion-events', 'In-app events', 1, context.aiChecks),
    aiCheck('conversion-cpp', 'Custom product pages', 1, context.aiChecks),
  ];
};

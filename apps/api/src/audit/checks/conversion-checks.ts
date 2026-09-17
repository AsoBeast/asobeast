import { AuditCheckResult } from '@asobeast/shared';
import {
  aiCheck,
  AuditContext,
  check,
  DAY_MS,
  FRESH_DAYS,
} from '../audit-scoring';

export const conversionChecks = (context: AuditContext): AuditCheckResult[] => {
  const hasNotes = Boolean(context.rawFacts.releaseNotes);
  const fresh =
    context.storeUpdatedAt !== null &&
    context.now.getTime() - context.storeUpdatedAt.getTime() <=
      FRESH_DAYS * DAY_MS;
  const freshnessScore = (hasNotes ? 5 : 0) + (fresh ? 5 : 0);
  return [
    check(
      'conversion-freshness',
      "What's New freshness",
      'auto',
      freshnessScore,
      `Release notes ${hasNotes ? 'present' : 'missing'}, updated ${
        fresh ? 'recently' : 'over 30 days ago'
      }.`,
    ),
    aiCheck('conversion-promo', 'Promotional text', context.aiChecks),
    aiCheck('conversion-events', 'In-app events', context.aiChecks),
    aiCheck('conversion-cpp', 'Custom product pages', context.aiChecks),
  ];
};

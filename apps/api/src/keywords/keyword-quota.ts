import { KeywordImportQuota, PaidPlanName } from '@asobeast/shared';
import { WorkspaceUsage } from '../auth/quota.service';

export function keywordQuotaOf(
  usage: WorkspaceUsage,
  upgradeTo: PaidPlanName | null,
): KeywordImportQuota | null {
  const limit = usage.limits.keywordMarkets;
  if (limit === null) {
    return null;
  }
  return { used: usage.keywordMarkets, limit, upgradeTo };
}

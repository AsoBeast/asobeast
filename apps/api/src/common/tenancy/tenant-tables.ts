export const TENANT_TABLES = [
  'ActionItem',
  'AlertDelivery',
  'AlertEvent',
  'ApiToken',
  'App',
  'AppGroup',
  'AppSnapshot',
  'AuditInsight',
  'AuditScore',
  'CategoryRank',
  'ChangeEvent',
  'EmailAlert',
  'KeywordRanking',
  'Review',
  'SuggestProbe',
  'TrackedKeyword',
  'User',
  'Webhook',
  'Workspace',
  'WorkspaceInvite',
] as const;

export const SHARED_STORE_TABLES = [
  'Keyword',
  'KeywordMetric',
  'SerpEntry',
] as const;

export const OPERATOR_TABLES = [
  'BillingEvent',
  'ProxyEndpoint',
  'ProxyHealth',
  'ProxySpend',
  'SupportAccess',
] as const;

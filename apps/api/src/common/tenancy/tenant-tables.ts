export const TENANT_TABLES = [
  'ActionEvent',
  'ActionItem',
  'AiCall',
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
  'SnapshotScreenshot',
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
  'ScreenshotText',
  'SearchTermPopularity',
  'SerpEntry',
] as const;

export const OPERATOR_TABLES = [
  'BillingEvent',
  'ProxyEndpoint',
  'ProxyHealth',
  'ProxySpend',
  'SupportAccess',
] as const;

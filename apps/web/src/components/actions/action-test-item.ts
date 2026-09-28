import type { ActionItem, ActionScope } from "@asobeast/shared";

export function actionItem(
  overrides: Partial<Omit<ActionItem, "scope">> & {
    scope?: Partial<ActionScope>;
  } = {},
): ActionItem {
  const { scope, ...rest } = overrides;
  return {
    id: "act-1",
    rule: "keyword.add_uncovered",
    category: "metadata",
    status: "OPEN",
    priority: "high",
    impact: 70,
    formulaVersion: "actions-v1",
    evidence: null,
    degraded: true,
    firstSeenAt: "2026-07-20T03:00:00.000Z",
    lastSeenAt: "2026-07-30T03:00:00.000Z",
    resolvedAt: null,
    snoozedUntil: null,
    closedAt: null,
    verifiedAt: null,
    reopenCount: 0,
    note: null,
    ai: { explanation: null, model: null, generatedAt: null },
    ...rest,
    scope: {
      appId: "app-1",
      appName: "Focus Timer",
      store: "APP_STORE",
      country: "us",
      keywordId: "kw-1",
      keywordText: "habit tracker",
      ...scope,
    },
  };
}

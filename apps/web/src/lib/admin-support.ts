import {
  SUPPORT_REASON_MAX_LENGTH,
  SUPPORT_REASON_MIN_LENGTH,
  type OnDemandAction,
  type OnDemandRules,
  type PlanLimit,
  type PlanLimits,
  type SupportAction,
  type SupportActionRequest,
  type SupportOutcome,
  type SupportWorkspaceSummary,
} from "@asobeast/shared";
import { formatNumber, formatPlanLimit } from "./format";

export interface LabelledValue {
  label: string;
  value: string;
}

type LimitKey = Exclude<keyof PlanLimits, "onDemand">;

const LIMIT_LABELS: Record<LimitKey, string> = {
  apps: "Apps",
  keywordMarkets: "Keyword markets",
  competitorsPerApp: "Competitors per app",
  chartFollows: "Followed charts",
  aiCallsPerMonth: "AI calls per month",
  apiRequestsPerMinute: "API requests per minute",
  apiWritesPerMinute: "API writes per minute",
  apiRequestsPerDay: "API requests per day",
  apiConcurrentRequests: "Concurrent API requests",
  mcpRequestsPerMinute: "MCP requests per minute",
};

const LIMIT_KEYS = Object.keys(LIMIT_LABELS) as LimitKey[];

const ON_DEMAND_LABELS: Record<OnDemandAction, string> = {
  refresh: "Refresh",
  runDaily: "Daily runs",
  score: "Rescores",
  suggestions: "Keyword suggestions",
  spider: "Deep searches",
  importApp: "App imports",
  addCompetitor: "Competitor adds",
  storeLookup: "Store lookups",
  chartCapture: "Chart captures",
};

const ON_DEMAND_KEYS = Object.keys(ON_DEMAND_LABELS) as OnDemandAction[];

const WINDOW_UNITS = [
  { seconds: 7 * 86_400, unit: "week", one: "a week" },
  { seconds: 86_400, unit: "day", one: "a day" },
  { seconds: 3_600, unit: "hour", one: "an hour" },
  { seconds: 60, unit: "minute", one: "a minute" },
  { seconds: 1, unit: "second", one: "a second" },
] as const;

type WorkspaceUsage = Pick<
  SupportWorkspaceSummary,
  "members" | "apps" | "competitors" | "keywordMarkets"
>;

export function usageLine(used: number, limit: PlanLimit): string {
  return limit === null
    ? `${formatNumber(used)}, no limit`
    : `${formatNumber(used)} of ${formatNumber(limit)}`;
}

function competitorLine(competitors: number, perApp: PlanLimit): string {
  return perApp === null
    ? `${formatNumber(competitors)} in all, no limit`
    : `${formatNumber(competitors)} in all, up to ${formatNumber(perApp)} per app`;
}

const USED: Partial<
  Record<LimitKey, (usage: WorkspaceUsage, limit: PlanLimit) => string>
> = {
  apps: (usage, limit) => usageLine(usage.apps, limit),
  keywordMarkets: (usage, limit) => usageLine(usage.keywordMarkets, limit),
  competitorsPerApp: (usage, limit) => competitorLine(usage.competitors, limit),
};

export function limitRows(limits: PlanLimits): LabelledValue[] {
  return LIMIT_KEYS.map((key) => ({
    label: LIMIT_LABELS[key],
    value: formatPlanLimit(limits[key]),
  }));
}

export function usageRows(
  limits: PlanLimits,
  usage: WorkspaceUsage,
): LabelledValue[] {
  return [
    { label: "Members", value: formatNumber(usage.members) },
    ...LIMIT_KEYS.map((key) => ({
      label: LIMIT_LABELS[key],
      value: USED[key]?.(usage, limits[key]) ?? formatPlanLimit(limits[key]),
    })),
  ];
}

function windowLabel(seconds: number): string {
  const {
    unit,
    one,
    seconds: size,
  } = WINDOW_UNITS.find((entry) => seconds % entry.seconds === 0) ??
  WINDOW_UNITS[WINDOW_UNITS.length - 1];
  const count = seconds / size;
  return count === 1 ? one : `every ${formatNumber(count)} ${unit}s`;
}

export function onDemandRows(rules: OnDemandRules | null): LabelledValue[] {
  if (!rules) return [];
  return ON_DEMAND_KEYS.map((action) => ({
    label: ON_DEMAND_LABELS[action],
    value: `${formatNumber(rules[action].limit)} ${windowLabel(rules[action].windowSeconds)}`,
  }));
}

const SUPPORT_ACTION_LABELS: Record<SupportAction, string> = {
  list: "Listed workspaces",
  view: "Viewed",
  reconcile: "Reconciled billing",
  suspend: "Suspended",
  restore: "Restored",
  "run-daily": "Started a daily run",
  replay: "Replayed a billing event",
};

const SUPPORT_OUTCOME_LABELS: Record<SupportOutcome, string> = {
  attempted: "In progress",
  succeeded: "Succeeded",
  failed: "Failed",
};

const QUEUE_LABELS: Record<string, string> = {
  appstore: "App Store",
  gplay: "Google Play",
};

export function supportActionLabel(action: SupportAction): string {
  return SUPPORT_ACTION_LABELS[action];
}

export function supportOutcomeLabel(outcome: SupportOutcome): string {
  return SUPPORT_OUTCOME_LABELS[outcome];
}

export function queueLabel(queue: string): string {
  return QUEUE_LABELS[queue] ?? queue;
}

export function supportReasonReady(text: string): boolean {
  const length = text.trim().length;
  return (
    length >= SUPPORT_REASON_MIN_LENGTH && length <= SUPPORT_REASON_MAX_LENGTH
  );
}

export function supportActionRequest(text: string): SupportActionRequest {
  return { confirm: true, reason: text.trim() };
}

export type WorkspaceAction = "suspend" | "restore";

type ActionSubject = Pick<
  SupportWorkspaceSummary,
  "operatorWorkspace" | "suspendedAt"
>;

export function availableActions(workspace: ActionSubject): WorkspaceAction[] {
  if (workspace.suspendedAt !== null) return ["restore"];
  return workspace.operatorWorkspace ? [] : ["suspend"];
}

export interface ActionCopy {
  open: string;
  title: (name: string) => string;
  body: (name: string) => string;
  confirm: string;
  pending: string;
  done: (name: string, detail: string) => string;
  variant: "destructive" | "default";
  replacesOpener: boolean;
}

export const ACTION_COPY: Record<WorkspaceAction, ActionCopy> = {
  suspend: {
    open: "Suspend",
    title: (name) => `Suspend ${name}?`,
    body: (name) =>
      `Every write and on demand action in ${name} is refused until you restore it. Every member of ${name} sees this reason on every page, so write it for them.`,
    confirm: "Suspend workspace",
    pending: "Suspending…",
    done: (name) => `${name} is suspended.`,
    variant: "destructive",
    replacesOpener: true,
  },
  restore: {
    open: "Restore",
    title: (name) => `Restore ${name}?`,
    body: (name) =>
      `${name} may write again, and the suspension notice disappears for its members. The reason is kept in the access log.`,
    confirm: "Restore workspace",
    pending: "Restoring…",
    done: (name) => `${name} may write again.`,
    variant: "default",
    replacesOpener: true,
  },
};

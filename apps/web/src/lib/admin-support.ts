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

const USAGE_LABELS: Partial<Record<LimitKey, string>> = {
  competitorsPerApp: "Competitors",
};

export function usageRows(
  limits: PlanLimits,
  usage: WorkspaceUsage,
): LabelledValue[] {
  return [
    { label: "Members", value: formatNumber(usage.members) },
    ...LIMIT_KEYS.map((key) => ({
      label: USAGE_LABELS[key] ?? LIMIT_LABELS[key],
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

const SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

const PRESENTATION_SEQUENCE = /[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g;

export function supportReasonLength(text: string): number {
  const pairs = text.match(SURROGATE_PAIR)?.length ?? 0;
  const sequences = text.match(PRESENTATION_SEQUENCE)?.length ?? 0;
  return text.length - pairs - sequences;
}

export function supportReasonReady(text: string): boolean {
  const length = supportReasonLength(text.trim());
  return (
    length >= SUPPORT_REASON_MIN_LENGTH && length <= SUPPORT_REASON_MAX_LENGTH
  );
}

export function supportActionRequest(text: string): SupportActionRequest {
  return { confirm: true, reason: text.trim() };
}

export type WorkspaceAction = "run-daily" | "reconcile" | "suspend" | "restore";

type ActionSubject = Pick<
  SupportWorkspaceSummary,
  "operatorWorkspace" | "suspendedAt"
>;

function actionsFor(
  suspended: boolean,
  operatorWorkspace: boolean,
  billing: boolean,
): WorkspaceAction[] {
  const offered: [WorkspaceAction, boolean][] = [
    ["run-daily", !suspended],
    ["reconcile", billing],
    ["suspend", !suspended && !operatorWorkspace],
    ["restore", suspended],
  ];
  return offered.filter(([, shown]) => shown).map(([action]) => action);
}

export function availableActions(
  workspace: ActionSubject,
  { billing }: { billing: boolean },
): WorkspaceAction[] {
  return actionsFor(
    workspace.suspendedAt !== null,
    workspace.operatorWorkspace === true,
    billing,
  );
}

const REPLACED_BY: Partial<Record<WorkspaceAction, WorkspaceAction>> = {
  suspend: "restore",
  restore: "suspend",
};

export function focusAfter(
  action: WorkspaceAction,
  workspace: ActionSubject,
  { billing }: { billing: boolean },
): WorkspaceAction | null {
  const replacement = REPLACED_BY[action];
  if (!replacement) return null;
  const next = actionsFor(
    action === "suspend",
    workspace.operatorWorkspace === true,
    billing,
  );
  return next.includes(replacement) ? replacement : (next[0] ?? null);
}

export function dailyRunDone(name: string, detail: string): string {
  const counts = detail.match(/\d+/g) ?? [];
  const nothingQueued =
    counts.length > 0 && counts.every((count) => Number(count) === 0);
  return nothingQueued
    ? `Nothing new to queue for ${name} today.`
    : `Daily run queued for ${name}.`;
}

interface ActionCopy {
  open: string;
  title: (name: string) => string;
  body: (name: string) => string;
  confirm: string;
  pending: string;
  done: (name: string, detail: string) => string;
  variant: "destructive" | "default";
}

export const ACTION_COPY: Record<WorkspaceAction, ActionCopy> = {
  "run-daily": {
    open: "Run daily",
    title: (name) => `Start a daily run for ${name}?`,
    body: (name) =>
      `Queues the app refreshes, keyword checks, reviews and category ranks of ${name} that have not run yet today, and queues again the ones that failed. A job of today the queue still holds is skipped, so work that already ran is usually not repeated.`,
    confirm: "Start daily run",
    pending: "Starting…",
    done: dailyRunDone,
    variant: "default",
  },
  reconcile: {
    open: "Reconcile billing",
    title: (name) => `Reconcile ${name} with Stripe?`,
    body: (name) =>
      `Reads the subscription of ${name} from Stripe and corrects the plan, trial and renewal stored here when they differ. If Stripe has no subscription for it, ${name} moves to Free, and a trial Stripe should not have started is cancelled. Nothing is charged.`,
    confirm: "Reconcile billing",
    pending: "Reconciling…",
    done: (name) => `${name} is reconciled with Stripe.`,
    variant: "default",
  },
  suspend: {
    open: "Suspend",
    title: (name) => `Suspend ${name}?`,
    body: (name) =>
      `Every write and on demand action in ${name} is refused until you restore it. Every member of ${name} sees this reason on every page, so write it for them.`,
    confirm: "Suspend workspace",
    pending: "Suspending…",
    done: (name) => `${name} is suspended.`,
    variant: "destructive",
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
  },
};

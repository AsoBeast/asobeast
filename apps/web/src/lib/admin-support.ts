import {
  ON_DEMAND_ACTIONS,
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
import type { MessageTranslator, TranslationContext } from "@/i18n/translator";
import { formatNumberInLocale } from "./format";

export interface LabelledValue {
  label: string;
  value: string;
}

type LimitKey = Exclude<keyof PlanLimits, "onDemand">;

const LIMIT_KEYS: readonly LimitKey[] = [
  "apps",
  "keywordMarkets",
  "competitorsPerApp",
  "chartFollows",
  "aiCallsPerMonth",
  "apiRequestsPerMinute",
  "apiWritesPerMinute",
  "apiRequestsPerDay",
  "apiConcurrentRequests",
  "mcpRequestsPerMinute",
];

const ON_DEMAND_KEYS: Record<OnDemandAction, string> = {
  refresh: "support.onDemandLabels.refresh",
  runDaily: "support.onDemandLabels.runDaily",
  score: "support.onDemandLabels.score",
  suggestions: "support.onDemandLabels.suggestions",
  spider: "support.onDemandLabels.spider",
  importApp: "support.onDemandLabels.importApp",
  addCompetitor: "support.onDemandLabels.addCompetitor",
  storeLookup: "support.onDemandLabels.storeLookup",
  chartCapture: "support.onDemandLabels.chartCapture",
};

interface WindowUnit {
  seconds: number;
  one: string;
  every: string;
}

const SECOND: WindowUnit = {
  seconds: 1,
  one: "support.windows.second",
  every: "support.windows.everySecond",
};

const WINDOW_UNITS: readonly WindowUnit[] = [
  {
    seconds: 7 * 86_400,
    one: "support.windows.week",
    every: "support.windows.everyWeek",
  },
  {
    seconds: 86_400,
    one: "support.windows.day",
    every: "support.windows.everyDay",
  },
  {
    seconds: 3_600,
    one: "support.windows.hour",
    every: "support.windows.everyHour",
  },
  {
    seconds: 60,
    one: "support.windows.minute",
    every: "support.windows.everyMinute",
  },
];

type WorkspaceUsage = Pick<
  SupportWorkspaceSummary,
  "members" | "apps" | "competitors" | "keywordMarkets"
>;

const number = (value: number, context: TranslationContext) =>
  formatNumberInLocale(value, context.locale);

export function usageLine(
  used: number,
  limit: PlanLimit,
  context: TranslationContext,
): string {
  return limit === null
    ? context.translator("support.usageUnlimited", {
        used: number(used, context),
      })
    : context.translator("support.usage", {
        used: number(used, context),
        limit: number(limit, context),
      });
}

function competitorLine(
  competitors: number,
  perApp: PlanLimit,
  context: TranslationContext,
): string {
  return perApp === null
    ? context.translator("support.competitorUsageUnlimited", {
        used: number(competitors, context),
      })
    : context.translator("support.competitorUsage", {
        used: number(competitors, context),
        limit: number(perApp, context),
      });
}

const USED: Partial<
  Record<
    LimitKey,
    (
      usage: WorkspaceUsage,
      limit: PlanLimit,
      context: TranslationContext,
    ) => string
  >
> = {
  apps: (usage, limit, context) => usageLine(usage.apps, limit, context),
  keywordMarkets: (usage, limit, context) =>
    usageLine(usage.keywordMarkets, limit, context),
  competitorsPerApp: (usage, limit, context) =>
    competitorLine(usage.competitors, limit, context),
};

const USAGE_LABELS: Partial<Record<LimitKey, string>> = {
  competitorsPerApp: "support.limitLabels.competitors",
};

function limitValue(value: PlanLimit, context: TranslationContext): string {
  return value === null
    ? context.translator("support.unlimited")
    : number(value, context);
}

export function usageRows(
  limits: PlanLimits,
  usage: WorkspaceUsage,
  context: TranslationContext,
): LabelledValue[] {
  return [
    {
      label: context.translator("support.limitLabels.members"),
      value: number(usage.members, context),
    },
    ...LIMIT_KEYS.map((key) => ({
      label: context.translator(
        USAGE_LABELS[key] ?? `support.limitLabels.${key}`,
      ),
      value:
        USED[key]?.(usage, limits[key], context) ??
        limitValue(limits[key], context),
    })),
  ];
}

function windowLabel(seconds: number, context: TranslationContext): string {
  const {
    one,
    every,
    seconds: size,
  } = WINDOW_UNITS.find((entry) => seconds % entry.seconds === 0) ?? SECOND;
  const count = seconds / size;
  return count === 1
    ? context.translator(one)
    : context.translator(every, { count: number(count, context) });
}

export function onDemandRows(
  rules: OnDemandRules | null,
  context: TranslationContext,
): LabelledValue[] {
  if (!rules) return [];
  return ON_DEMAND_ACTIONS.map((action) => ({
    label: context.translator(ON_DEMAND_KEYS[action]),
    value: context.translator("support.allowance", {
      count: number(rules[action].limit, context),
      window: windowLabel(rules[action].windowSeconds, context),
    }),
  }));
}

const SUPPORT_ACTION_KEYS: Record<SupportAction, string> = {
  list: "support.actions.list",
  view: "support.actions.view",
  reconcile: "support.actions.reconcile",
  suspend: "support.actions.suspend",
  restore: "support.actions.restore",
  "run-daily": "support.actions.runDaily",
  replay: "support.actions.replay",
};

const SUPPORT_OUTCOME_KEYS: Record<SupportOutcome, string> = {
  attempted: "support.outcomes.attempted",
  succeeded: "support.outcomes.succeeded",
  failed: "support.outcomes.failed",
};

const QUEUE_KEYS: Record<string, string> = {
  appstore: "support.queues.appstore",
  gplay: "support.queues.gplay",
};

export function supportActionLabel(
  action: SupportAction,
  translator: MessageTranslator,
): string {
  return translator(SUPPORT_ACTION_KEYS[action]);
}

export function supportOutcomeLabel(
  outcome: SupportOutcome,
  translator: MessageTranslator,
): string {
  return translator(SUPPORT_OUTCOME_KEYS[outcome]);
}

export function queueLabel(
  queue: string,
  translator: MessageTranslator,
): string {
  const key = QUEUE_KEYS[queue];
  return key ? translator(key) : queue;
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

function clampSupportReason(text: string): string {
  const points = Array.from(text);
  let fits = 0;
  let over = points.length;
  while (fits < over) {
    const middle = Math.ceil((fits + over) / 2);
    if (
      supportReasonLength(points.slice(0, middle).join("")) <=
      SUPPORT_REASON_MAX_LENGTH
    ) {
      fits = middle;
    } else {
      over = middle - 1;
    }
  }
  return points.slice(0, fits).join("");
}

export function nextSupportReason(current: string, typed: string): string {
  if (supportReasonLength(typed) <= SUPPORT_REASON_MAX_LENGTH) return typed;
  return supportReasonLength(current) >= SUPPORT_REASON_MAX_LENGTH
    ? current
    : clampSupportReason(typed);
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

export function focusAfterConflict(
  action: WorkspaceAction,
  workspace: ActionSubject,
  options: { billing: boolean },
): WorkspaceAction | null {
  const stateFound = action === "run-daily" ? "suspend" : action;
  return focusAfter(stateFound, workspace, options);
}

export function dailyRunDone(
  name: string,
  detail: string,
  translator: MessageTranslator,
): string {
  const counts = detail.match(/\d+/g) ?? [];
  const nothingQueued =
    counts.length > 0 && counts.every((count) => Number(count) === 0);
  return translator(
    nothingQueued
      ? "support.runDaily.nothingQueued"
      : "support.runDaily.queued",
    {
      name,
    },
  );
}

export interface ActionCopy {
  open: string;
  title: (name: string) => string;
  body: (name: string) => string;
  confirm: string;
  pending: string;
  done: (name: string, detail: string) => string;
  variant: "destructive" | "default";
}

export function supportActionCopy(
  action: WorkspaceAction,
  translator: MessageTranslator,
): ActionCopy {
  if (action === "run-daily") {
    return {
      open: translator("support.runDaily.open"),
      title: (name) => translator("support.runDaily.title", { name }),
      body: (name) => translator("support.runDaily.body", { name }),
      confirm: translator("support.runDaily.confirm"),
      pending: translator("support.runDaily.pending"),
      done: (name, detail) => dailyRunDone(name, detail, translator),
      variant: "default",
    };
  }
  return {
    open: translator(`support.${action}.open`),
    title: (name) => translator(`support.${action}.title`, { name }),
    body: (name) => translator(`support.${action}.body`, { name }),
    confirm: translator(`support.${action}.confirm`),
    pending: translator(`support.${action}.pending`),
    done: (name) => translator(`support.${action}.done`, { name }),
    variant: action === "suspend" ? "destructive" : "default",
  };
}

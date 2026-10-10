import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { planMockImport } from "./keyword-import.mts";
import { summarizeActions } from "./actions-summary.mts";
import {
  ACTION_ACTIVITY,
  EMPTY_ACTION_ACTIVITY,
  initialActionEvents,
  outcomeFor,
  trendFor,
} from "./action-details.mts";
import {
  ACTIONS,
  ACTION_SUMMARY,
  APP_AUDIT,
  AUDIT_HISTORY_POINTS,
  LONG_AUDIT,
  PLAY_AUDIT,
  PROVISIONAL_AUDIT,
  METADATA_AUDIT,
  APP_1_PL_SCREENSHOTS,
  APP_1_PL_LOCALIZED_SCREENSHOTS,
  METADATA_AUDIT_PL,
  METADATA_AUDIT_PL_LOCALIZED,
  MARKET_BUDGET,
  METADATA_AUDITS,
  UNREAD_MARKET_COOKIE,
  UNREAD_MARKET_COVERAGE_ROW,
  APP_1_LISTING_MARKETS,
  APP_1_PL_CHANGES,
  APP_1_PL_DETAIL,
  METADATA_DRAFTS,
  APP_LONG_METADATA_DRAFTS,
  APP_1_KEYWORD_COUNTRIES,
  BUDGET,
  DATASETS,
  EMAIL_ALERTS,
  EMAIL_DELIVERIES,
  FIRST_RUN_COMPLETE,
  FIRST_RUN_MID,
  FIRST_RUN_UNSCHEDULED,
  HEALTH,
  RUN_STATUS,
  RUN_STATUS_DELAYED,
  STORE_HEALTH_BROKEN,
  STORE_HEALTH_OK,
  IMPORTED_APP,
  IMPORTED_APP_DETAIL,
  IMPORTED_PORTFOLIO_APP,
  MANY_PORTFOLIO_APPS,
  PENDING_PORTFOLIO_APP,
  INITIAL_APPS,
  HOT_BUDGET,
  LAPSED_BUDGET,
  METRICS_SCRAPE,
  OPERATOR_TOKEN,
  VALID_UNSUBSCRIBE_TOKEN,
  OVER_LIMIT_BUDGET,
  PORTFOLIO,
  RATE_LIMIT_RESET_SECONDS,
  RECENT_CHANGES,
  SCREENSHOTS,
  SERP_SNAPSHOTS,
  WEBHOOKS,
  emptyScreenshots,
  errorEnvelope,
  rateLimitedEnvelope,
} from "./fixtures.mts";
import {
  EMPTY_PORTFOLIO_INSIGHTS,
  FRESH_PORTFOLIO_INSIGHTS,
  MANY_PORTFOLIO_INSIGHTS,
  PORTFOLIO_INSIGHTS,
  QUIET_PORTFOLIO_INSIGHTS,
  UNRANKED_PORTFOLIO_INSIGHTS,
} from "./portfolio-insights.mts";
import type {
  AccountPlan,
  ActionBulkUpdateResult,
  ActionDetail,
  ActionDismissReason,
  ActionEventItem,
  ActionEventType,
  ActionItem,
  ActionSummary,
  ActionUpdateStatus,
  AppAuditResult,
  AppScreenshots,
  WorkspaceTeam,
  ActionStatus,
  AuthUser,
  CompetitorAddRequest,
  CompetitorItem,
  DailyBudget,
  EmailAlertCreateRequest,
  EmailAlertUpdateRequest,
  EmailAlertItem,
  FirstRunStatus,
  KeywordFieldRequest,
  KeywordAddRequest,
  KeywordFieldResult,
  KeywordImportRequest,
  MetadataAssistantRequest,
  MetadataAssistantResult,
  MetadataAuditResult,
  KeywordSort,
  ParsedStoreUrl,
  StoreHealthReport,
  WorkspaceRunStatus,
  PortfolioSummary,
  KeywordUpdateRequest,
  TrackedKeywordItem,
  WebhookCreateRequest,
  WebhookItem,
  WebhookUpdateRequest,
  WorkspaceDeletionStatus,
} from "@asobeast/shared";
import {
  DELETION_CONFIRMATION,
  KEYWORD_BULK_ADD_LIMIT,
  KEYWORD_IMPORT_LIMIT,
  isKeywordTag,
  KEYWORD_FIELD_BYTE_LIMIT,
  KEYWORD_TAGS_MAX,
  normalizeKeywordNote,
  normalizeKeywordTags,
  keywordFieldBytes,
  parseKeywordField,
  SESSION_COOKIE,
  SELF_HOSTED_LIMITS,
  UPGRADE_PATH,
  parseStoreUrl,
  isStorefront,
  UnknownStorefrontError,
} from "@asobeast/shared";
import { ALL_VIEWERS, VIEWER_COOKIE, type Viewer } from "./viewer.mts";
import {
  ADMIN_OVERVIEW,
  ADMIN_OVERVIEW_SELF_HOSTED,
  CAPACITY_REPORT,
  PROXY_POOL_OFF,
  PROXY_POOL_ON,
  SUPPORT_WORKSPACES,
  adminAppList,
  adminUserList,
} from "./admin-fixtures.mts";

const PORT = Number(process.env.MOCK_API_PORT ?? 4100);
const ERROR_ID = "err-app";
const MCP_STREAM_MS = 3_000;
const apps = [...INITIAL_APPS];
const PENDING_SERVED = new Map<string, number>();
const KEYWORD_QUOTA_COOKIE = "e2e_keyword_quota";
const initialKeywords = new Map(
  Object.entries(DATASETS).map(([id, dataset]) => [
    id,
    structuredClone(dataset.keywords),
  ]),
);

function resetKeywords(only?: string): void {
  for (const [id, keywords] of initialKeywords) {
    if (only === undefined || id === only) {
      DATASETS[id].keywords = structuredClone(keywords);
    }
  }
}

function manualKeyword(
  appId: string,
  text: string,
  country: string,
  index: number,
): TrackedKeywordItem {
  return {
    keywordId: `kw-${appId}-added-${index}`,
    text,
    country,
    serpVolatility7d: null,
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
  };
}

const annotations = new Map<
  string,
  Map<string, Pick<TrackedKeywordItem, "tags" | "note">>
>();

function annotated(
  appId: string,
  keyword: TrackedKeywordItem,
): TrackedKeywordItem {
  return { ...keyword, ...annotations.get(appId)?.get(keyword.keywordId) };
}
const actions: ActionItem[] = ACTIONS.map((action) => structuredClone(action));
const actionEvents: Record<string, ActionEventItem[]> =
  initialActionEvents(ACTIONS);
const portfolioApps = [...PORTFOLIO.apps, PENDING_PORTFOLIO_APP];
const webhooks = [...WEBHOOKS];
const emailAlerts = [...EMAIL_ALERTS];
const keywordFields = new Map<string, string>();
const AUTH_USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "premium",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: true,
};
const VIEWER_USERS: Record<Viewer, Partial<AuthUser>> = {
  customer: {
    id: "u2",
    email: "customer@example.com",
    name: "Customer",
    platformOperator: false,
  },
  member: {
    id: "u3",
    email: "member@example.com",
    name: "Member",
    role: "member",
    platformOperator: false,
  },
  "lapsed-operator": { plan: "free", entitled: false },
  "unconfirmed-operator": {
    plan: "free",
    entitled: false,
    emailVerified: false,
    trialAwaitsConfirmation: true,
  },
};
const ACCOUNT_PLAN: AccountPlan = {
  plan: "indie",
  displayName: "Indie",
  billing: false,
  entitled: true,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  renewsAt: null,
  upgradeTo: null,
  upgradePath: UPGRADE_PATH,
  limits: SELF_HOSTED_LIMITS,
  usage: {
    apps: { used: 2, limit: null },
    keywordMarkets: { used: 12, limit: null },
    aiCalls: { used: 4, limit: null, resetsAt: "2026-11-01T00:00:00.000Z" },
  },
};
const BILLING_COOKIE = "e2e_billing";
const METADATA_AI_COOKIE = "e2e_metadata_ai";
const METADATA_AI_MODEL = "gpt-test";
const BILLING_ACCOUNT_PLAN: AccountPlan = { ...ACCOUNT_PLAN, billing: true };
const PLAN_COOKIE = "e2e_plan";

function accountPlanFor(req: IncomingMessage): AccountPlan {
  const seeded = cookieValue(req, PLAN_COOKIE);
  if (seeded) {
    return JSON.parse(
      Buffer.from(seeded, "base64url").toString("utf8"),
    ) as AccountPlan;
  }
  return hasCookie(req, BILLING_COOKIE, "1")
    ? BILLING_ACCOUNT_PLAN
    : ACCOUNT_PLAN;
}

const TEAM: WorkspaceTeam = {
  members: [
    {
      id: "u1",
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "u2",
      email: "teammate@example.com",
      name: null,
      role: "member",
      createdAt: "2026-07-15T00:00:00.000Z",
    },
  ],
  invites: [
    {
      id: "inv1",
      email: "pending@example.com",
      role: "member",
      expiresAt: "2026-08-20T00:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
};

type Handler = (
  params: string[],
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

function resetActions(): void {
  actions.splice(
    0,
    actions.length,
    ...ACTIONS.map((action) => structuredClone(action)),
  );
  for (const id of Object.keys(actionEvents)) delete actionEvents[id];
  Object.assign(actionEvents, initialActionEvents(ACTIONS));
}

interface ActionTransitionBody {
  status: ActionUpdateStatus;
  snoozedUntil?: string;
  note?: string;
  reason?: ActionDismissReason;
  revert?: boolean;
}

function transitionEvent(
  previous: ActionStatus,
  target: ActionUpdateStatus,
): ActionEventType | null {
  if (target === "DONE") return "done";
  if (target === "DISMISSED") return "dismissed";
  if (target === "SNOOZED") return "snoozed";
  if (previous === "OPEN") return null;
  return previous === "SNOOZED" ? "woke" : "reopened";
}

function noteOnly(action: ActionItem, body: ActionTransitionBody): boolean {
  if (body.revert || body.status !== action.status) return false;
  if (body.status === "SNOOZED") {
    return body.snoozedUntil === action.snoozedUntil;
  }
  return body.status === "DONE" || body.status === "DISMISSED";
}

function transition(action: ActionItem, body: ActionTransitionBody): void {
  if (body.note !== undefined) action.note = body.note.trim();
  if (noteOnly(action, body)) return;
  const previous = action.status;
  const events = (actionEvents[action.id] ??= []);
  action.status = body.status;
  action.snoozedUntil =
    body.status === "SNOOZED" ? (body.snoozedUntil ?? null) : null;
  action.closedAt =
    body.status === "DONE" || body.status === "DISMISSED"
      ? new Date().toISOString()
      : null;
  action.verifiedAt = null;
  if (body.revert) {
    const undone = events.findLastIndex((entry) => entry.actor === "user");
    if (undone >= 0) events.splice(undone, 1);
    return;
  }
  const type = transitionEvent(previous, body.status);
  if (type === "reopened") action.reopenCount += 1;
  if (!type) return;
  events.push({
    id: `${action.id}-${events.length}`,
    type,
    actor: "user",
    actorName: "You",
    occurredAt: new Date().toISOString(),
    status: body.status,
    priority: action.priority,
    impact: action.impact,
    snoozedUntil: action.snoozedUntil,
    reason: body.reason ?? null,
  });
}

function actionDetail(action: ActionItem): ActionDetail {
  const trend = trendFor(action);
  return {
    ...action,
    events: actionEvents[action.id] ?? [],
    trend,
    outcome: outcomeFor(action, trend),
  };
}

function cookieValue(req: IncomingMessage, name: string): string | undefined {
  for (const pair of (req.headers.cookie ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator > 0 && pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function viewerOf(req: IncomingMessage): AuthUser {
  const viewer = ALL_VIEWERS.find(
    (candidate) => candidate === cookieValue(req, VIEWER_COOKIE),
  );
  return viewer ? { ...AUTH_USER, ...VIEWER_USERS[viewer] } : AUTH_USER;
}

async function delayFromCookie(
  req: IncomingMessage,
  name: string,
): Promise<void> {
  const ms = Number(cookieValue(req, name));
  if (ms > 0) await delay(ms);
}

function hasCookie(
  req: IncomingMessage,
  name: string,
  value?: string,
): boolean {
  const actual = cookieValue(req, name);
  return actual !== undefined && (value === undefined || actual === value);
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
): void {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function scoreForSort(
  keyword: TrackedKeywordItem,
  sort: KeywordSort,
): number | null {
  if (sort === "traffic") return keyword.volume;
  if (sort === "difficulty") return keyword.difficulty;
  if (sort === "opportunity") return keyword.opportunity;
  return null;
}

function sortKeywords(
  list: TrackedKeywordItem[],
  sort: string | null,
): TrackedKeywordItem[] {
  if (sort === "position") {
    return [...list].sort(
      (a, b) => (a.latestPosition ?? Infinity) - (b.latestPosition ?? Infinity),
    );
  }
  if (sort === "traffic" || sort === "difficulty" || sort === "opportunity") {
    return [...list].sort(
      (a, b) =>
        (scoreForSort(b, sort) ?? -Infinity) -
        (scoreForSort(a, sort) ?? -Infinity),
    );
  }
  return list;
}

function withoutScreenshotText<T extends { screenshotText?: unknown }>(
  value: T,
): T {
  const copy = { ...value };
  delete copy.screenshotText;
  return copy;
}

function withScreenshotText(
  req: IncomingMessage,
  result: MetadataAuditResult,
): MetadataAuditResult {
  const coverage = result.coverage.map(withoutScreenshotText);
  if (result.store === "GOOGLE_PLAY") {
    return withoutScreenshotText({ ...result, coverage });
  }
  if (hasCookie(req, "e2e_screenshots_off", "1") && result.screenshotText) {
    return {
      ...result,
      coverage,
      screenshotText: { ...result.screenshotText, status: "off", read: 0 },
    };
  }
  return result;
}

function appRoute(
  pattern: RegExp,
  pick: (
    dataset: (typeof DATASETS)[string],
    query: URLSearchParams,
    req: IncomingMessage,
  ) => unknown,
): Route {
  return {
    method: "GET",
    pattern,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (id === ERROR_ID || hasCookie(req, "e2e-fail-app", "1")) {
        return json(res, 500, errorEnvelope(500, path));
      }
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      json(
        res,
        200,
        pick(dataset, new URL(path, "http://localhost").searchParams, req),
      );
    },
  };
}

function isPolishListingOf(
  dataset: (typeof DATASETS)[string],
  query: URLSearchParams,
): boolean {
  return dataset.detail.id === "app-1" && query.get("country") === "pl";
}

function gatedRoute(
  pattern: RegExp,
  pick: (req: IncomingMessage, query: URLSearchParams) => unknown,
  admits: (req: IncomingMessage) => boolean,
): Route {
  return {
    method: "GET",
    pattern,
    handler: (_params, req, res) => {
      const path = req.url ?? "/";
      if (!admits(req)) return json(res, 404, errorEnvelope(404, path));
      json(res, 200, pick(req, new URL(path, "http://localhost").searchParams));
    },
  };
}

function operatorRoute(
  pattern: RegExp,
  pick: (req: IncomingMessage, query: URLSearchParams) => unknown,
): Route {
  return gatedRoute(pattern, pick, (req) => viewerOf(req).platformOperator);
}

function supportRoute(
  pattern: RegExp,
  pick: (req: IncomingMessage, query: URLSearchParams) => unknown,
): Route {
  return gatedRoute(pattern, pick, (req) => {
    const viewer = viewerOf(req);
    return (
      viewer.platformOperator &&
      viewer.entitled &&
      !hasCookie(req, "e2e_admin_refused", "1")
    );
  });
}

function splitValues(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function filterActions(url: URL, appId?: string): ActionItem[] {
  const statuses = splitValues(url.searchParams.get("status"));
  const priorities = splitValues(url.searchParams.get("priority"));
  const rules = splitValues(url.searchParams.get("rule"));
  const wanted = statuses.length > 0 ? statuses : ["OPEN", "SNOOZED"];

  return actions
    .filter((action) => wanted.includes(action.status))
    .filter(
      (action) =>
        priorities.length === 0 || priorities.includes(action.priority),
    )
    .filter((action) => rules.length === 0 || rules.includes(action.rule))
    .filter((action) => !appId || action.scope.appId === appId)
    .sort(
      (left, right) =>
        right.impact - left.impact ||
        left.firstSeenAt.localeCompare(right.firstSeenAt) ||
        left.id.localeCompare(right.id),
    );
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
    });
    req.on("end", () => resolve(raw));
  });
}

function withBody<T>(
  req: IncomingMessage,
  res: ServerResponse,
  handle: (body: T) => void,
): void {
  void readBody(req)
    .then((raw) => {
      let body: T;
      try {
        body = JSON.parse(raw || "{}") as T;
      } catch {
        return json(
          res,
          400,
          errorEnvelope(400, req.url ?? "/", "Malformed JSON body"),
        );
      }
      handle(body);
    })
    .catch(() => {
      if (!res.writableEnded) {
        json(res, 500, errorEnvelope(500, req.url ?? "/"));
      }
    });
}

function refusesEvents(events: unknown): boolean {
  return events !== undefined && !(Array.isArray(events) && events.length > 0);
}

function trackedFromKeywordField(
  text: string,
  country: string,
): TrackedKeywordItem {
  return {
    keywordId: `kw-field-${text.replace(/ /g, "-")}`,
    text,
    country,
    serpVolatility7d: null,
    source: "KEYWORD_FIELD",
    active: true,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
  };
}

function keywordFieldResult(text: string, country: string): KeywordFieldResult {
  const { phrases, duplicatesRemoved } = parseKeywordField(text);

  return {
    tracked: phrases.map((value) => trackedFromKeywordField(value, country)),
    charactersUsed: keywordFieldBytes(phrases),
    charactersLimit: KEYWORD_FIELD_BYTE_LIMIT,
    duplicatesRemoved,
  };
}

function keywordFieldDataset(
  id: string,
  req: IncomingMessage,
  res: ServerResponse,
): (typeof DATASETS)[string] | undefined {
  const path = req.url ?? "/";
  const dataset = DATASETS[id];
  if (!dataset) {
    json(res, 404, errorEnvelope(404, path, `App ${id} not found`));
    return undefined;
  }
  if (dataset.detail.store !== "APP_STORE") {
    json(
      res,
      400,
      errorEnvelope(
        400,
        path,
        "The keyword field is only available for App Store apps",
      ),
    );
    return undefined;
  }
  return dataset;
}

const CAPTURED_SUBTITLE = "Focus timer and planner";
const CAPTURED_SHORT_DESCRIPTION =
  "Focus timer and planner for deep work, study blocks and real breaks";

function capturedCompetitor(
  dataset: (typeof DATASETS)[string],
  parsed: ParsedStoreUrl,
): CompetitorItem {
  const discovered = dataset.discovery.items.find(
    (item) => item.storeAppId === parsed.storeAppId,
  );
  const title = discovered?.title ?? parsed.storeAppId;

  return {
    id: `comp-${parsed.storeAppId}`,
    store: parsed.store,
    name: title,
    iconUrl: null,
    latestSnapshot: {
      id: `snap-comp-${parsed.storeAppId}`,
      title,
      subtitle: parsed.store === "APP_STORE" ? CAPTURED_SUBTITLE : null,
      summary:
        parsed.store === "GOOGLE_PLAY" ? CAPTURED_SHORT_DESCRIPTION : null,
      ratingAvg: discovered?.ratingAvg ?? null,
      ratingCount: discovered?.ratingCount ?? null,
      installs: null,
      price: 0,
      version: "1.0.0",
      capturedAt: new Date().toISOString(),
    },
  };
}

function storeHealthFor(req: IncomingMessage): StoreHealthReport {
  return hasCookie(req, "e2e_store_broken", "1")
    ? STORE_HEALTH_BROKEN
    : STORE_HEALTH_OK;
}

const RUN_FAILURE = "OpenAI rejected the API key. Check OPENAI_API_KEY.";

const RUN_REQUESTED_AT_COOKIE = "e2e_ai_requested_at";
const RUN_AGE_MS = 4_000;

const runRequestedAt = (req: IncomingMessage): string =>
  cookieValue(req, RUN_REQUESTED_AT_COOKIE) ??
  new Date(Date.now() - RUN_AGE_MS).toISOString();

const runState = (
  req: IncomingMessage,
  state: "queued" | "running" | "completed" | "failed",
  error: string | null = null,
): NonNullable<AppAuditResult["ai"]["run"]> => ({
  state,
  requestedAt: runRequestedAt(req),
  finishedAt: state === "completed" ? new Date().toISOString() : null,
  error,
});

function auditBase(id: string, req: IncomingMessage): AppAuditResult {
  if (id === "app-gp") return PLAY_AUDIT;
  if (id === "app-long") return LONG_AUDIT;
  if (id === "app-2") return { ...APP_AUDIT, appId: id, benchmarks: null };
  if (hasCookie(req, "e2e_audit", "provisional")) {
    return { ...PROVISIONAL_AUDIT, appId: id };
  }
  return { ...APP_AUDIT, appId: id };
}

const AUDIT_SLOW_MS = 1_500;

function auditFor(id: string, req: IncomingMessage, res: ServerResponse): void {
  const base = auditBase(id, req);
  if (hasCookie(req, "e2e_ai_unconfigured", "1")) {
    json(res, 200, {
      ...base,
      creative: null,
      ai: { ...base.ai, configured: false, model: null, run: null },
    });
    return;
  }
  const configured = { ...base.ai, configured: true, model: "gpt-5.6-luna" };
  if (hasCookie(req, "e2e_ai_stale", "1")) {
    json(res, 200, {
      ...base,
      creative: base.creative ? { ...base.creative, stale: true } : null,
      ai: { ...configured, stale: true, run: runState(req, "completed") },
    });
    return;
  }
  const run = cookieValue(req, "e2e_ai_run");
  if (run === "queued") {
    json(
      res,
      200,
      {
        ...base,
        creative: null,
        ai: { ...configured, generatedAt: null, run: runState(req, "running") },
      },
      { "set-cookie": "e2e_ai_run=running; Path=/" },
    );
    return;
  }
  if (run === "running") {
    const failing = hasCookie(req, "e2e_ai_fail", "1");
    json(
      res,
      200,
      failing
        ? {
            ...base,
            creative: null,
            ai: {
              ...configured,
              generatedAt: null,
              run: runState(req, "failed", RUN_FAILURE),
            },
          }
        : {
            ...base,
            overall: (base.overall ?? 0) + 3,
            creative: APP_AUDIT.creative,
            ai: {
              ...configured,
              generatedAt: new Date().toISOString(),
              run: runState(req, "completed"),
            },
          },
      {
        "set-cookie": [
          "e2e_ai_run=; Path=/; Max-Age=0",
          failing ? "e2e_ai_failed=1; Path=/" : "e2e_ai_done=1; Path=/",
        ],
      },
    );
    return;
  }
  if (hasCookie(req, "e2e_ai_failed", "1")) {
    json(res, 200, {
      ...base,
      creative: null,
      ai: {
        ...configured,
        generatedAt: null,
        run: runState(req, "failed", RUN_FAILURE),
      },
    });
    return;
  }
  if (hasCookie(req, "e2e_ai_done", "1")) {
    json(res, 200, {
      ...base,
      overall: (base.overall ?? 0) + 3,
      creative: APP_AUDIT.creative,
      ai: {
        ...configured,
        generatedAt: new Date().toISOString(),
        run: runState(req, "completed"),
      },
    });
    return;
  }
  json(res, 200, {
    ...base,
    ai: {
      ...configured,
      run: base.creative ? runState(req, "completed") : null,
    },
  });
}

function requestAuditRun(req: IncomingMessage, res: ServerResponse): void {
  if (hasCookie(req, "e2e_ai_unconfigured", "1")) {
    json(
      res,
      409,
      errorEnvelope(409, req.url ?? "/", "AI features require OPENAI_API_KEY"),
    );
    return;
  }
  if (hasCookie(req, "e2e_ai_reused", "1")) {
    json(res, 202, { ...runState(req, "completed"), reused: true });
    return;
  }
  const requestedAt = new Date(Date.now() - RUN_AGE_MS).toISOString();
  json(
    res,
    202,
    {
      state: "queued",
      requestedAt,
      finishedAt: null,
      error: null,
      reused: false,
    },
    {
      "set-cookie": [
        `${RUN_REQUESTED_AT_COOKIE}=${requestedAt}; Path=/`,
        "e2e_ai_run=queued; Path=/",
        "e2e_ai_done=; Path=/; Max-Age=0",
        "e2e_ai_failed=; Path=/; Max-Age=0",
      ],
    },
  );
}

function actionsUngenerated(req: IncomingMessage): boolean {
  return hasCookie(req, "e2e_actions_ungenerated", "1");
}

function actionsGeneratedAt(req: IncomingMessage): string | null {
  return (
    cookieValue(req, "actions_generated_at") ??
    (actionsUngenerated(req) ? null : ACTION_SUMMARY.generatedAt)
  );
}

function actionSummaryFor(req: IncomingMessage): ActionSummary {
  const url = new URL(req.url ?? "/", "http://localhost");
  const appId = url.searchParams.get("appId");
  const store = url.searchParams.get("store");
  const country = url.searchParams.get("country");
  const scoped = actionsUngenerated(req)
    ? []
    : actions.filter(
        (action) =>
          (!appId || action.scope.appId === appId) &&
          (!store || action.scope.store === store) &&
          (!country || action.scope.country === country),
      );
  return summarizeActions(scoped, {
    generatedAt: actionsGeneratedAt(req),
    suppressedByCap: ACTION_SUMMARY.suppressedByCap,
  });
}

function followActionRun(req: IncomingMessage, res: ServerResponse): void {
  const finishing = cookieValue(req, "actions_run_finishing");
  if (finishing === undefined) {
    json(res, 200, actionSummaryFor(req));
    return;
  }
  if (!hasCookie(req, "actions_run_polled", "1")) {
    json(res, 200, actionSummaryFor(req), {
      "set-cookie": "actions_run_polled=1; Path=/",
    });
    return;
  }
  const summary = actionSummaryFor(req);
  json(
    res,
    200,
    { ...summary, generatedAt: finishing },
    {
      "set-cookie": [
        `actions_generated_at=${finishing}; Path=/`,
        "actions_run_finishing=; Path=/; Max-Age=0",
        "actions_run_polled=; Path=/; Max-Age=0",
      ],
    },
  );
}

function actionListFor(
  req: IncomingMessage,
  appId?: string,
): { items: ActionItem[]; total: number; generatedAt: string | null } {
  const url = new URL(req.url ?? "/", "http://localhost");
  const items = actionsUngenerated(req) ? [] : filterActions(url, appId);
  return { items, total: items.length, generatedAt: actionsGeneratedAt(req) };
}

const DELETION_COOKIE = "workspace_deletion_requested";
const DELETION_GRACE_DAYS = 7;
const UNSCHEDULED_DELETION: WorkspaceDeletionStatus = {
  scheduled: false,
  requestedAt: null,
  requestedBy: null,
  dueAt: null,
  graceDays: DELETION_GRACE_DAYS,
};

function scheduledDeletion(requestedAt: string): WorkspaceDeletionStatus {
  const due = new Date(requestedAt);
  due.setUTCDate(due.getUTCDate() + DELETION_GRACE_DAYS);
  return {
    scheduled: true,
    requestedAt,
    requestedBy: AUTH_USER.email,
    dueAt: due.toISOString(),
    graceDays: DELETION_GRACE_DAYS,
  };
}

function deletionStatusFor(req: IncomingMessage): WorkspaceDeletionStatus {
  const requestedAt = cookieValue(req, DELETION_COOKIE);
  return requestedAt ? scheduledDeletion(requestedAt) : UNSCHEDULED_DELETION;
}

function runStatusFor(req: IncomingMessage): WorkspaceRunStatus {
  return hasCookie(req, "e2e_run_delayed", "1")
    ? RUN_STATUS_DELAYED
    : RUN_STATUS;
}

const FIRST_RUN_FAIL_COOKIE = "e2e_first_run_fail";
const FIRST_RUN_LATENCY_COOKIE = "e2e_first_run_latency";

function firstRunFor(appId: string): FirstRunStatus {
  if (appId === "app-new") return FIRST_RUN_MID;
  if (appId === "app-2") return FIRST_RUN_UNSCHEDULED;
  return { ...FIRST_RUN_COMPLETE, appId };
}

const API_LATENCY_COOKIE = "e2e_api_latency";
const BUDGET_HOLD_COOKIE = "e2e_budget_hold";
const BUDGET_QUOTA_COOKIE = "e2e_budget_quota";
const STALE_MARKET_COOKIE = "e2e_stale_market";
const BUDGET_HOT_COOKIE = "e2e_budget_hot";
const BUDGETS_BY_QUOTA = new Map<string | undefined, DailyBudget>([
  ["lapsed", LAPSED_BUDGET],
  ["over", OVER_LIMIT_BUDGET],
  ["markets", MARKET_BUDGET],
]);
const INSIGHTS_HOLD_COOKIE = "e2e_insights_hold";

type Holds = Map<string, PromiseWithResolvers<void>>;

const budgetHolds: Holds = new Map();
const insightsHolds: Holds = new Map();

function holdFor(holds: Holds, token: string): PromiseWithResolvers<void> {
  const existing = holds.get(token);
  if (existing) return existing;
  const hold = Promise.withResolvers<void>();
  holds.set(token, hold);
  return hold;
}

const budgetHold = (token: string) => holdFor(budgetHolds, token);
const insightsHold = (token: string) => holdFor(insightsHolds, token);
const activityHolds: Holds = new Map();
const activityHold = (token: string) => holdFor(activityHolds, token);

const unsubscribeCalls = new Map<string, number>();

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/__unsubscribes\/([^/]+)$/,
    handler: ([id], _req, res) =>
      json(res, 200, { calls: unsubscribeCalls.get(id) ?? 0 }),
  },
  {
    method: "POST",
    pattern: /^\/email-alerts\/([^/]+)\/unsubscribe$/,
    handler: ([id], req, res) => {
      unsubscribeCalls.set(id, (unsubscribeCalls.get(id) ?? 0) + 1);
      const token = new URL(
        req.url ?? "/",
        "http://localhost",
      ).searchParams.get("token");
      if (token !== VALID_UNSUBSCRIBE_TOKEN) {
        json(
          res,
          404,
          errorEnvelope(404, req.url ?? "/", "Email alert not found"),
        );
        return;
      }
      res.writeHead(204);
      res.end();
    },
  },
  supportRoute(/^\/admin\/support\/overview$/, (req) =>
    hasCookie(req, "e2e_admin_self_hosted", "1")
      ? ADMIN_OVERVIEW_SELF_HOSTED
      : ADMIN_OVERVIEW,
  ),
  operatorRoute(/^\/admin\/capacity$/, () => CAPACITY_REPORT),
  {
    method: "GET",
    pattern: /^\/metrics$/,
    handler: (_p, req, res) => {
      if (req.headers.authorization !== `Bearer ${OPERATOR_TOKEN}`) {
        json(res, 404, errorEnvelope(404, req.url ?? "/metrics"));
        return;
      }
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      res.end(METRICS_SCRAPE);
    },
  },
  operatorRoute(/^\/admin\/proxy-pool$/, (req) =>
    hasCookie(req, "e2e_proxy_pool", "1") ? PROXY_POOL_ON : PROXY_POOL_OFF,
  ),
  supportRoute(/^\/admin\/support\/workspaces$/, () => SUPPORT_WORKSPACES),
  supportRoute(/^\/admin\/support\/users$/, (req, query) =>
    adminUserList(
      query.get("workspaceId"),
      hasCookie(req, "e2e_admin_truncated", "1"),
    ),
  ),
  supportRoute(/^\/admin\/support\/apps$/, (req, query) =>
    adminAppList(
      query.get("workspaceId"),
      hasCookie(req, "e2e_admin_truncated", "1"),
    ),
  ),
  {
    method: "POST",
    pattern: /^\/__reset\/keywords(?:\/([^/]+))?$/,
    handler: ([id], _req, res) => {
      resetKeywords(id);
      json(res, 200, { reset: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/__reset\/keyword-annotations\/([^/]+)$/,
    handler: ([id], _req, res) => {
      annotations.delete(id);
      json(res, 200, { reset: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/__reset\/actions$/,
    handler: (_p, _req, res) => {
      resetActions();
      json(res, 200, { reset: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/__budget-holds\/([^/]+)\/release$/,
    handler: ([token], _req, res) => {
      budgetHold(token).resolve();
      json(res, 200, { released: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/__activity-holds\/([^/]+)\/release$/,
    handler: ([token], _req, res) => {
      activityHold(token).resolve();
      json(res, 200, { released: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/__insights-holds\/([^/]+)\/release$/,
    handler: ([token], _req, res) => {
      insightsHold(token).resolve();
      json(res, 200, { released: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/mcp$/,
    handler: (_p, req, res) => {
      if (!req.headers.authorization) {
        json(res, 401, errorEnvelope(401, req.url ?? "/mcp"), {
          "www-authenticate": 'Bearer realm="asobeast"',
        });
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(": open\n\n");
      setTimeout(() => {
        res.end(
          'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n',
        );
      }, MCP_STREAM_MS);
    },
  },
  {
    method: "GET",
    pattern: /^\/mcp$/,
    handler: (_p, _req, res) =>
      json(
        res,
        405,
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
        },
        { allow: "POST" },
      ),
  },
  {
    method: "GET",
    pattern: /^\/health$/,
    handler: (_p, _q, res) => json(res, 200, HEALTH),
  },
  {
    method: "GET",
    pattern: /^\/jobs\/run-status$/,
    handler: (_p, req, res) => json(res, 200, runStatusFor(req)),
  },
  {
    method: "GET",
    pattern: /^\/jobs\/store-health$/,
    handler: (_p, req, res) => json(res, 200, storeHealthFor(req)),
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/first-run$/,
    handler: async (params, req, res) => {
      await delayFromCookie(req, FIRST_RUN_LATENCY_COOKIE);
      if (hasCookie(req, FIRST_RUN_FAIL_COOKIE, "1")) {
        return json(res, 500, errorEnvelope(500, req.url ?? "/"));
      }
      json(res, 200, firstRunFor(params[0]));
    },
  },
  {
    method: "GET",
    pattern: /^\/auth\/status$/,
    handler: (_p, req, res) => {
      const setupRequired = hasCookie(req, "e2e_setup_required", "1");
      const authenticated = hasCookie(req, SESSION_COOKIE);
      json(res, 200, {
        billing: hasCookie(req, BILLING_COOKIE, "1"),
        registrationOpen: setupRequired,
        setupRequired,
        authenticated,
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/auth\/me$/,
    handler: (_p, req, res) => {
      const authenticated = hasCookie(req, SESSION_COOKIE);
      if (!authenticated) {
        return json(res, 401, errorEnvelope(401, req.url ?? "/auth/me"));
      }
      json(res, 200, viewerOf(req));
    },
  },
  {
    method: "POST",
    pattern: /^\/auth\/password\/forgot$/,
    handler: (_p, _req, res) => {
      res.writeHead(204).end();
    },
  },
  {
    method: "POST",
    pattern: /^\/auth\/password\/reset$/,
    handler: (_p, _req, res) => {
      res.writeHead(204).end();
    },
  },
  {
    method: "GET",
    pattern: /^\/billing\/catalog$/,
    handler: (_p, _q, res) => json(res, 200, { enabled: false, prices: [] }),
  },
  {
    method: "GET",
    pattern: /^\/workspace\/team$/,
    handler: (_p, req, res) => {
      if (!hasCookie(req, SESSION_COOKIE)) {
        return json(res, 401, errorEnvelope(401, req.url ?? "/workspace/team"));
      }
      json(res, 200, TEAM);
    },
  },
  {
    method: "GET",
    pattern: /^\/account\/deletion$/,
    handler: (_p, req, res) => json(res, 200, deletionStatusFor(req)),
  },
  {
    method: "POST",
    pattern: /^\/account\/deletion$/,
    handler: (_p, req, res) =>
      withBody<{ confirm?: string }>(req, res, (body) => {
        if (body.confirm !== DELETION_CONFIRMATION) {
          return json(
            res,
            400,
            errorEnvelope(
              400,
              req.url ?? "/account/deletion",
              `confirm must be equal to ${DELETION_CONFIRMATION}`,
            ),
          );
        }
        const requestedAt = new Date().toISOString();
        json(res, 201, scheduledDeletion(requestedAt), {
          "set-cookie": `${DELETION_COOKIE}=${requestedAt}; Path=/`,
        });
      }),
  },
  {
    method: "DELETE",
    pattern: /^\/account\/deletion$/,
    handler: (_p, _req, res) =>
      json(res, 200, UNSCHEDULED_DELETION, {
        "set-cookie": `${DELETION_COOKIE}=; Path=/; Max-Age=0`,
      }),
  },
  {
    method: "GET",
    pattern: /^\/auth\/plan$/,
    handler: (_p, req, res) => {
      if (!hasCookie(req, SESSION_COOKIE)) {
        return json(res, 401, errorEnvelope(401, req.url ?? "/auth/plan"));
      }
      json(res, 200, accountPlanFor(req));
    },
  },
  {
    method: "GET",
    pattern: /^\/apps$/,
    handler: (_p, _q, res) => json(res, 200, apps),
  },
  {
    method: "GET",
    pattern: /^\/portfolio$/,
    handler: (_p, req, res) => {
      const path = req.url ?? "/portfolio";
      if (hasCookie(req, "portfolio_rate_limited", "1")) {
        return json(res, 429, rateLimitedEnvelope(path), {
          "retry-after": String(RATE_LIMIT_RESET_SECONDS),
        });
      }
      const empty = hasCookie(req, "portfolio_empty", "1");
      const listed = hasCookie(req, "portfolio_many", "1")
        ? [...portfolioApps, ...MANY_PORTFOLIO_APPS]
        : portfolioApps;
      json(res, 200, {
        ...PORTFOLIO,
        apps: empty ? [] : listed,
        groups: empty ? [] : PORTFOLIO.groups,
        totals: {
          ...PORTFOLIO.totals,
          apps: empty ? 0 : listed.length,
        },
      } satisfies PortfolioSummary);
    },
  },
  {
    method: "GET",
    pattern: /^\/portfolio\/insights$/,
    handler: (_p, req, res) => {
      if (hasCookie(req, "portfolio_empty", "1")) {
        return json(res, 200, EMPTY_PORTFOLIO_INSIGHTS);
      }
      if (hasCookie(req, "portfolio_many", "1")) {
        return json(res, 200, MANY_PORTFOLIO_INSIGHTS);
      }
      const insights = hasCookie(req, "portfolio_insights_quiet", "1")
        ? QUIET_PORTFOLIO_INSIGHTS
        : hasCookie(req, "portfolio_insights_unranked", "1")
          ? UNRANKED_PORTFOLIO_INSIGHTS
          : hasCookie(req, "portfolio_insights_fresh", "1")
            ? FRESH_PORTFOLIO_INSIGHTS
            : PORTFOLIO_INSIGHTS;
      const token = cookieValue(req, INSIGHTS_HOLD_COOKIE);
      if (!token) return json(res, 200, insights);
      void insightsHold(token).promise.then(() => json(res, 200, insights));
    },
  },
  {
    method: "GET",
    pattern: /^\/changes\/recent$/,
    handler: (_p, _q, res) => json(res, 200, RECENT_CHANGES),
  },
  {
    method: "GET",
    pattern: /^\/webhooks$/,
    handler: (_p, req, res) =>
      json(res, 200, hasCookie(req, "e2e-empty-alerts", "1") ? [] : webhooks),
  },
  {
    method: "POST",
    pattern: /^\/webhooks$/,
    handler: (_p, req, res) => {
      withBody<WebhookCreateRequest>(req, res, (body) => {
        const webhook: WebhookItem = {
          id: `hook-${webhooks.length + 1}`,
          url: body.url,
          events: body.events,
          active: true,
          hasSecret: Boolean(body.secret),
          createdAt: new Date().toISOString(),
        };
        webhooks.unshift(webhook);
        json(res, 201, webhook);
      });
    },
  },
  {
    method: "PATCH",
    pattern: /^\/webhooks\/([^/]+)$/,
    handler: (params, req, res) => {
      withBody<WebhookUpdateRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        const webhook = webhooks.find((row) => row.id === params[0]);
        if (!webhook) return json(res, 404, errorEnvelope(404, path));
        if (refusesEvents(body.events)) {
          return json(
            res,
            400,
            errorEnvelope(400, path, "events should not be empty"),
          );
        }
        if (body.url !== undefined) webhook.url = body.url;
        if (body.events !== undefined) webhook.events = body.events;
        if (body.active !== undefined) webhook.active = body.active;
        if (body.secret !== undefined) webhook.hasSecret = body.secret !== "";
        json(res, 200, webhook);
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/alerts\/config$/,
    handler: (_p, _q, res) => json(res, 200, { emailEnabled: true }),
  },
  {
    method: "GET",
    pattern: /^\/alerts\/delivery$/,
    handler: (_p, req, res) => {
      const instant = hasCookie(req, "delivery_status", "instant");
      json(
        res,
        200,
        instant
          ? {
              mode: "instant",
              pipelineCron: "15 2 * * *",
              trigger: "daily_pipeline_completion",
              lastFlushAt: null,
              pending: 0,
              claimed: 2,
            }
          : {
              mode: "batched",
              pipelineCron: "0 3 * * *",
              trigger: "daily_pipeline_completion",
              lastFlushAt: "2026-07-22T07:00:00.000Z",
              pending: 3,
              claimed: 1,
            },
      );
    },
  },
  {
    method: "POST",
    pattern: /^\/alerts\/flush$/,
    handler: (_p, _q, res) =>
      json(res, 200, { flushed: 7, channels: 2, notifications: 4 }),
  },
  {
    method: "GET",
    pattern: /^\/email-alerts$/,
    handler: (_p, req, res) =>
      json(
        res,
        200,
        hasCookie(req, "e2e-empty-alerts", "1") ? [] : emailAlerts,
      ),
  },
  {
    method: "POST",
    pattern: /^\/email-alerts$/,
    handler: (_p, req, res) => {
      withBody<EmailAlertCreateRequest>(req, res, (body) => {
        const alert: EmailAlertItem = {
          id: `email-${emailAlerts.length + 1}`,
          email: body.email,
          events: body.events,
          active: true,
          createdAt: new Date().toISOString(),
        };
        emailAlerts.unshift(alert);
        json(res, 201, alert);
      });
    },
  },
  {
    method: "PATCH",
    pattern: /^\/email-alerts\/([^/]+)$/,
    handler: (params, req, res) => {
      withBody<EmailAlertUpdateRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        const alert = emailAlerts.find((row) => row.id === params[0]);
        if (!alert) return json(res, 404, errorEnvelope(404, path));
        if (refusesEvents(body.events)) {
          return json(
            res,
            400,
            errorEnvelope(400, path, "events should not be empty"),
          );
        }
        if (body.email !== undefined) alert.email = body.email;
        if (body.events !== undefined) alert.events = body.events;
        if (body.active !== undefined) alert.active = body.active;
        json(res, 200, alert);
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/alerts\/deliveries$/,
    handler: (_p, req, res) => {
      const query = new URL(req.url ?? "/", "http://localhost").searchParams;
      json(res, 200, query.get("emailAlertId") ? EMAIL_DELIVERIES : []);
    },
  },
  {
    method: "POST",
    pattern: /^\/keywords\/([^/]+)\/score$/,
    handler: (_p, _q, res) => json(res, 202, { enqueued: 1 }),
  },
  {
    method: "GET",
    pattern: /^\/keywords\/([^/]+)\/serp$/,
    handler: ([keywordId], req, res) => {
      const snapshot = SERP_SNAPSHOTS[keywordId];
      if (!snapshot) {
        return json(res, 404, errorEnvelope(404, req.url ?? "/"));
      }
      json(res, 200, snapshot);
    },
  },
  {
    method: "GET",
    pattern: /^\/jobs\/budget$/,
    handler: (_p, req, res) => {
      const budget =
        BUDGETS_BY_QUOTA.get(cookieValue(req, BUDGET_QUOTA_COOKIE)) ??
        (hasCookie(req, BUDGET_HOT_COOKIE, "1") ? HOT_BUDGET : BUDGET);
      const token = cookieValue(req, BUDGET_HOLD_COOKIE);
      if (!token) {
        json(res, 200, budget);
        return;
      }
      void budgetHold(token).promise.then(() => json(res, 200, budget));
    },
  },
  {
    method: "POST",
    pattern: /^\/apps$/,
    handler: (_p, _q, res) => {
      if (!apps.some((app) => app.id === IMPORTED_APP.id)) {
        apps.push(IMPORTED_APP);
        portfolioApps.push(IMPORTED_PORTFOLIO_APP);
      }
      json(res, 201, IMPORTED_APP_DETAIL);
    },
  },
  appRoute(/^\/apps\/([^/]+)$/, (dataset, query) =>
    isPolishListingOf(dataset, query) ? APP_1_PL_DETAIL : dataset.detail,
  ),
  appRoute(/^\/apps\/([^/]+)\/listing-markets$/, (dataset, _query, req) =>
    dataset.detail.id === "app-1"
      ? APP_1_LISTING_MARKETS.map((market) => ({
          ...market,
          tracked:
            market.home || !hasCookie(req, STALE_MARKET_COOKIE, market.country),
        }))
      : [
          {
            country: dataset.detail.country,
            home: true,
            capturedAt: dataset.detail.latestSnapshot?.capturedAt ?? null,
            tracked: true,
          },
        ],
  ),
  {
    method: "DELETE",
    pattern: /^\/apps\/([^/]+)$/,
    handler: ([id], req, res) => {
      if (!DATASETS[id]) {
        return json(res, 404, errorEnvelope(404, req.url ?? "/"));
      }
      res.writeHead(204).end();
    },
  },
  appRoute(/^\/apps\/([^/]+)\/summary$/, (dataset) => dataset.summary),
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/keywords$/,
    handler: ([id], req, res) => {
      withBody<KeywordAddRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        const dataset = DATASETS[id];
        if (!dataset) return json(res, 404, errorEnvelope(404, path));
        if (body.keywords.length > KEYWORD_BULK_ADD_LIMIT) {
          return json(
            res,
            400,
            errorEnvelope(
              400,
              path,
              `keywords must contain no more than ${KEYWORD_BULK_ADD_LIMIT} elements`,
            ),
          );
        }
        const country = body.country ?? dataset.detail.country;
        const inMarket = (text: string) =>
          dataset.keywords.find(
            (row) => row.text === text && row.country === country,
          );
        const activating = body.keywords.filter(
          (text) => !inMarket(text)?.active,
        );
        const used = dataset.keywords.filter((row) => row.active).length;
        const limit = Number(cookieValue(req, KEYWORD_QUOTA_COOKIE));
        if (limit > 0 && used + activating.length > limit) {
          return json(res, 403, {
            ...errorEnvelope(
              403,
              path,
              `keywordMarkets limit reached: ${used} of ${limit} used on the indie plan, ${activating.length} more requested`,
            ),
            quota: {
              resource: "keywordMarkets",
              plan: "indie",
              limit,
              used,
              requested: activating.length,
              upgradeTo: "ultimate",
            },
          });
        }
        for (const text of activating) {
          const existing = inMarket(text);
          if (existing) {
            existing.active = true;
          } else {
            dataset.keywords.push(
              manualKeyword(id, text, country, dataset.keywords.length + 1),
            );
          }
        }
        json(
          res,
          201,
          dataset.keywords.filter((row) => row.country === country),
        );
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/keywords\/import(\/preview)?$/,
    handler: ([id, preview], req, res) => {
      withBody<KeywordImportRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        const dataset = DATASETS[id];
        if (!dataset) return json(res, 404, errorEnvelope(404, path));
        if (body.rows.length > KEYWORD_IMPORT_LIMIT) {
          return json(
            res,
            400,
            errorEnvelope(
              400,
              path,
              `rows must contain no more than ${KEYWORD_IMPORT_LIMIT} elements`,
            ),
          );
        }
        const limit = Number(cookieValue(req, KEYWORD_QUOTA_COOKIE)) || null;
        const { result, additions } = planMockImport(
          dataset.keywords,
          dataset.detail.store,
          dataset.detail.country,
          body,
          limit,
        );
        if (preview) return json(res, 200, result);
        if (hasCookie(req, "e2e_import_race", "1")) {
          return json(res, 403, {
            ...errorEnvelope(
              403,
              path,
              "keywordMarkets limit reached: 998 of 1000 used on the indie plan, 5 more requested",
            ),
            quota: {
              resource: "keywordMarkets",
              plan: "indie",
              limit: 1000,
              used: 998,
              requested: 5,
              upgradeTo: "ultimate",
            },
          });
        }
        for (const addition of additions) {
          const existing = dataset.keywords.find(
            (row) =>
              row.text === addition.text && row.country === addition.country,
          );
          if (existing) {
            existing.active = true;
          } else {
            dataset.keywords.push({
              ...manualKeyword(
                id,
                addition.text,
                addition.country,
                dataset.keywords.length + 1,
              ),
              tags: addition.tags,
              note: addition.note,
            });
          }
        }
        json(res, 200, {
          ...result,
          dryRun: false,
          imported: additions.length,
          quota: result.quota && {
            ...result.quota,
            used: result.quota.used + additions.length,
          },
        });
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/keywords$/,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      const query = new URL(path, "http://localhost").searchParams;
      const country = query.get("country");
      const scoped = country
        ? dataset.keywords.filter((keyword) => keyword.country === country)
        : dataset.keywords;
      json(
        res,
        200,
        sortKeywords(
          scoped.map((keyword) => annotated(id, keyword)),
          query.get("sort"),
        ),
      );
    },
  },
  {
    method: "PATCH",
    pattern: /^\/apps\/([^/]+)\/keywords\/([^/]+)$/,
    handler: ([id, keywordId], req, res) => {
      withBody<KeywordUpdateRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        if (hasCookie(req, "e2e-fail-keyword-patch", "1")) {
          return json(res, 500, errorEnvelope(500, path));
        }
        const keyword = DATASETS[id]?.keywords.find(
          (row) => row.keywordId === keywordId,
        );
        if (!keyword) return json(res, 404, errorEnvelope(404, path));
        const tags =
          body.tags === undefined ? undefined : normalizeKeywordTags(body.tags);
        if (
          tags !== undefined &&
          (tags.length > KEYWORD_TAGS_MAX || !tags.every(isKeywordTag))
        ) {
          return json(res, 400, errorEnvelope(400, path, "invalid tags"));
        }
        const current = annotated(id, keyword);
        const stored = {
          tags: tags ?? current.tags ?? [],
          note:
            body.note === undefined
              ? (current.note ?? null)
              : normalizeKeywordNote(body.note),
        };
        const appAnnotations = annotations.get(id) ?? new Map();
        appAnnotations.set(keywordId, stored);
        annotations.set(id, appAnnotations);
        json(res, 200, {
          ...current,
          ...stored,
          active: body.active ?? current.active,
        });
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/metadata\/audit$/,
    handler: ([id], req, res) => {
      const path = req.url ?? "/";
      if (
        !apps.some((app) => app.id === id) &&
        !Object.hasOwn(METADATA_AUDITS, id)
      ) {
        return json(res, 404, errorEnvelope(404, path, "App not found"));
      }
      const query = new URL(path, "http://localhost").searchParams;
      const market = query.get("country");
      if (id === "app-1" && market === "pl") {
        return json(
          res,
          200,
          withScreenshotText(
            req,
            query.get("localization") === "pl"
              ? METADATA_AUDIT_PL_LOCALIZED
              : METADATA_AUDIT_PL,
          ),
        );
      }
      if (market !== null && market !== DATASETS[id]?.detail.country) {
        return json(
          res,
          404,
          errorEnvelope(404, path, `No listing captured for ${market}`),
        );
      }
      const audit = METADATA_AUDITS[id] ?? METADATA_AUDIT;
      const home = DATASETS[id]?.detail.country;
      json(
        res,
        200,
        withScreenshotText(req, {
          ...audit,
          appId: id,
          store: DATASETS[id]?.detail.store ?? METADATA_AUDIT.store,
          coverage:
            market === null
              ? [
                  ...audit.coverage,
                  ...(hasCookie(req, UNREAD_MARKET_COOKIE, "1")
                    ? [UNREAD_MARKET_COVERAGE_ROW]
                    : []),
                ]
              : audit.coverage.filter((row) => (row.country ?? home) === home),
        }),
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/metadata\/assistant$/,
    handler: (_p, req, res) =>
      json(
        res,
        200,
        hasCookie(req, METADATA_AI_COOKIE, "1")
          ? { configured: true, model: METADATA_AI_MODEL }
          : { configured: false, model: null },
      ),
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/metadata\/assistant$/,
    handler: ([id], req, res) => {
      withBody<MetadataAssistantRequest>(req, res, (body) => {
        if (!apps.some((app) => app.id === id)) {
          return json(
            res,
            404,
            errorEnvelope(404, req.url ?? "/", "App not found"),
          );
        }
        const fields =
          body.fields ?? METADATA_DRAFTS.map((draft) => draft.field);
        const result: MetadataAssistantResult = {
          model: METADATA_AI_MODEL,
          localization: body.localization ?? null,
          drafts: (id === "app-long"
            ? APP_LONG_METADATA_DRAFTS
            : METADATA_DRAFTS
          ).filter((draft) => fields.includes(draft.field)),
        };
        json(res, 201, result);
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/audit$/,
    handler: ([id], req, res) => {
      if (!apps.some((app) => app.id === id)) {
        json(res, 404, errorEnvelope(404, req.url ?? "/", "App not found"));
        return;
      }
      if (hasCookie(req, "e2e_audit_fail", "1")) {
        json(res, 500, errorEnvelope(500, req.url ?? "/"));
        return;
      }
      if (hasCookie(req, "e2e_audit_slow", "1")) {
        setTimeout(() => auditFor(id, req, res), AUDIT_SLOW_MS);
        return;
      }
      auditFor(id, req, res);
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/audit\/ai\/runs$/,
    handler: ([id], req, res) => {
      if (!apps.some((app) => app.id === id)) {
        json(res, 404, errorEnvelope(404, req.url ?? "/", "App not found"));
        return;
      }
      requestAuditRun(req, res);
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/audit\/history$/,
    handler: ([id], req, res) =>
      apps.some((app) => app.id === id)
        ? json(res, 200, {
            points: id === "app-gp" ? AUDIT_HISTORY_POINTS : [],
          })
        : json(res, 404, errorEnvelope(404, req.url ?? "/", "App not found")),
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/keyword-countries$/,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      if (hasCookie(req, "e2e-keyword-countries-error", "1")) {
        return json(res, 500, errorEnvelope(500, path));
      }
      if (id === "app-1") return json(res, 200, APP_1_KEYWORD_COUNTRIES);
      json(res, 200, [
        {
          country: dataset.detail.country,
          keywordCount: dataset.keywords.length,
        },
      ]);
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/screenshots$/,
    handler: ([id], req, res) => {
      const path = req.url ?? "/";
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      const query = new URL(path, "http://localhost").searchParams;
      const market = query.get("country");
      if (isPolishListingOf(dataset, query)) {
        return json(
          res,
          200,
          query.get("localization") === "pl"
            ? APP_1_PL_LOCALIZED_SCREENSHOTS
            : APP_1_PL_SCREENSHOTS,
        );
      }
      if (market !== null && !isStorefront(dataset.detail.store, market)) {
        return json(
          res,
          400,
          errorEnvelope(
            400,
            path,
            new UnknownStorefrontError(dataset.detail.store, market).message,
          ),
        );
      }
      if (market !== null && market !== dataset.detail.country) {
        return json(
          res,
          404,
          errorEnvelope(404, path, `No listing captured for ${market}`),
        );
      }
      const base: AppScreenshots = {
        ...(SCREENSHOTS[id] ?? emptyScreenshots(id, dataset.detail.store)),
        country: dataset.detail.country,
      };
      if (hasCookie(req, "e2e_screenshots_off", "1")) {
        return json(res, 200, {
          ...base,
          reading: "off",
          screenshots: base.screenshots.map((item) => ({
            ...item,
            caption: null,
            status: "skipped",
          })),
        });
      }
      const pending = cookieValue(req, "e2e_screenshots_pending");
      if (pending !== undefined) {
        const served = PENDING_SERVED.get(pending) ?? 0;
        PENDING_SERVED.set(pending, served + 1);
        if (served === 0) {
          return json(res, 200, {
            ...base,
            screenshots: base.screenshots.map((item) =>
              item.position > 1
                ? { ...item, caption: null, status: "pending" }
                : item,
            ),
          });
        }
      }
      json(res, 200, base);
    },
  },
  appRoute(/^\/apps\/([^/]+)\/changes$/, (dataset, query) =>
    isPolishListingOf(dataset, query) ? APP_1_PL_CHANGES : dataset.changes,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/changes\/impact$/,
    (dataset) => dataset.changeImpact,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/competitors\/discovery$/,
    (dataset) => dataset.discovery,
  ),
  appRoute(/^\/apps\/([^/]+)\/keywords\/compare$/, (dataset, query) =>
    query.get("onlyGaps") === "true"
      ? {
          ...dataset.comparison,
          rows: dataset.comparison.rows.filter((row) => row.gap),
        }
      : dataset.comparison,
  ),
  appRoute(/^\/apps\/([^/]+)\/rankings$/, (dataset) => dataset.rankings),
  appRoute(/^\/apps\/([^/]+)\/serp-movers$/, (dataset) => dataset.serpMovers),
  appRoute(
    /^\/apps\/([^/]+)\/visibility-history$/,
    (dataset) => dataset.visibility,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/rank-distribution-history$/,
    (dataset) => dataset.rankDistributionHistory,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/category-ranks$/,
    (dataset) => dataset.categoryRanks,
  ),
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/competitors$/,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (hasCookie(req, "e2e-fail-competitors", "1")) {
        return json(res, 500, errorEnvelope(500, path));
      }
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      json(res, 200, dataset.competitors);
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/competitors$/,
    handler: ([id], req, res) => {
      withBody<CompetitorAddRequest>(req, res, (body) => {
        const path = req.url ?? "/";
        const dataset = DATASETS[id];
        if (!dataset) {
          return json(
            res,
            404,
            errorEnvelope(404, path, `App ${id} not found`),
          );
        }

        let parsed: ParsedStoreUrl;
        try {
          parsed = parseStoreUrl(body.url ?? "");
        } catch (error) {
          return json(
            res,
            400,
            errorEnvelope(400, path, (error as Error).message),
          );
        }

        if (parsed.store !== dataset.detail.store) {
          return json(
            res,
            400,
            errorEnvelope(
              400,
              path,
              "Competitor must be on the same store as the primary app",
            ),
          );
        }

        const captured = capturedCompetitor(dataset, parsed);
        const existing = dataset.competitors.find(
          (row) => row.id === captured.id,
        );
        if (!existing) dataset.competitors.push(captured);
        json(res, 201, existing ?? captured);
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/keyword-field$/,
    handler: ([id], req, res) => {
      const dataset = keywordFieldDataset(id, req, res);
      if (!dataset) return;
      json(
        res,
        200,
        keywordFieldResult(keywordFields.get(id) ?? "", dataset.detail.country),
      );
    },
  },
  {
    method: "PUT",
    pattern: /^\/apps\/([^/]+)\/keyword-field$/,
    handler: ([id], req, res) => {
      withBody<KeywordFieldRequest>(req, res, (body) => {
        const dataset = keywordFieldDataset(id, req, res);
        if (!dataset) return;
        const result = keywordFieldResult(
          body.text ?? "",
          dataset.detail.country,
        );
        keywordFields.set(
          id,
          result.tracked.map((keyword) => keyword.text).join(","),
        );
        json(res, 200, result);
      });
    },
  },
  appRoute(
    /^\/apps\/([^/]+)\/ratings-history$/,
    (dataset) => dataset.ratingsHistory,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/reviews\/histogram$/,
    (dataset) => dataset.ratingsHistogram,
  ),
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/reviews$/,
    handler: (params, req, res) => {
      const [id] = params;
      const path = req.url ?? "/";
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
      const dataset = DATASETS[id];
      if (!dataset) return json(res, 404, errorEnvelope(404, path));
      const query = new URL(path, "http://localhost").searchParams;
      const score = query.get("score");
      const version = query.get("version");
      const filtered = dataset.reviews.reviews.filter(
        (review) =>
          (!score || review.score === Number(score)) &&
          (!version || review.version === version),
      );
      json(res, 200, {
        reviews: filtered,
        total: filtered.length,
        versions: dataset.reviews.versions,
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/actions$/,
    handler: (_p, req, res) => json(res, 200, actionListFor(req)),
  },
  {
    method: "GET",
    pattern: /^\/actions\/activity$/,
    handler: (_p, req, res) => {
      const activity = actionsUngenerated(req)
        ? EMPTY_ACTION_ACTIVITY
        : ACTION_ACTIVITY;
      const token = cookieValue(req, "e2e_activity_hold");
      if (!token) return json(res, 200, activity);
      void activityHold(token).promise.then(() => json(res, 200, activity));
    },
  },
  {
    method: "GET",
    pattern: /^\/actions\/summary$/,
    handler: (_p, req, res) => followActionRun(req, res),
  },
  {
    method: "GET",
    pattern: /^\/actions\/ai-status$/,
    handler: (_p, _req, res) =>
      json(res, 200, { configured: false, model: null }),
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/actions$/,
    handler: (params, req, res) =>
      json(res, 200, actionListFor(req, params[0])),
  },
  {
    method: "POST",
    pattern: /^\/actions\/run$/,
    handler: (_p, _req, res) =>
      json(
        res,
        202,
        { queued: true, jobId: "actions~ws_default" },
        {
          "set-cookie": `actions_run_finishing=${new Date().toISOString()}; Path=/`,
        },
      ),
  },
  {
    method: "GET",
    pattern: /^\/actions\/([^/]+)$/,
    handler: (params, req, res) => {
      const action = actions.find((row) => row.id === params[0]);
      if (!action) return json(res, 404, errorEnvelope(404, req.url ?? "/"));
      json(res, 200, actionDetail(action));
    },
  },
  {
    method: "PATCH",
    pattern: /^\/actions$/,
    handler: (_params, req, res) => {
      withBody<ActionTransitionBody & { ids: string[] }>(req, res, (body) => {
        if (body.ids.includes("act-degraded")) {
          return json(res, 500, errorEnvelope(500, req.url ?? "/"));
        }
        const result: ActionBulkUpdateResult = {
          items: [],
          missing: [],
          conflicts: [],
        };
        for (const id of body.ids) {
          const action = actions.find((row) => row.id === id);
          if (!action) {
            result.missing.push(id);
          } else if (action.status === "RESOLVED" && body.status !== "OPEN") {
            result.conflicts.push(id);
          } else {
            transition(action, body);
            result.items.push(action);
          }
        }
        json(res, 200, result);
      });
    },
  },
  {
    method: "PATCH",
    pattern: /^\/actions\/([^/]+)$/,
    handler: (params, req, res) => {
      withBody<ActionTransitionBody>(req, res, (body) => {
        const path = req.url ?? "/";
        const action = actions.find((row) => row.id === params[0]);
        if (!action) return json(res, 404, errorEnvelope(404, path));
        if (action.id === "act-degraded") {
          return json(res, 500, errorEnvelope(500, path));
        }
        transition(action, body);
        json(res, 200, action);
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/refresh$/,
    handler: (params, req, res) => {
      const country = new URL(
        req.url ?? "/",
        "http://localhost",
      ).searchParams.get("country");
      if (country === "pl") {
        return json(res, 200, {
          snapshotId: "snap-pl",
          changes: [{ field: "title", before: 8, after: 18 }],
          country: "pl",
        });
      }
      if (params[0] === "app-2") {
        return json(res, 200, {
          snapshotId: "snap-2",
          changes: [
            {
              field: "icon",
              before: "https://is1-ssl.mzstatic.com/image/thumb/a/icon.png",
              after: "https://is1-ssl.mzstatic.com/image/thumb/b/icon.png",
            },
            {
              field: "screenshotImages",
              before: "8 screenshots",
              after: "8 screenshots, reordered",
            },
          ],
          country: "us",
        });
      }
      return json(res, 200, { snapshotId: "snap-1", changes: [] });
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/run-daily$/,
    handler: (_p, _q, res) =>
      json(res, 202, {
        enqueued: { apps: 1, keywords: 5, categories: 1, reviews: 1 },
      }),
  },
];

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  await delayFromCookie(req, API_LATENCY_COOKIE);
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = pathname.match(route.pattern);
    if (match) return route.handler(match.slice(1), req, res);
  }
  json(res, 404, errorEnvelope(404, req.url ?? "/"));
});

server.listen(PORT, () => {
  process.stdout.write(`mock-api listening on ${PORT}\n`);
});

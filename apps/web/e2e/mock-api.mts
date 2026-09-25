import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  ACTIONS,
  ACTION_SUMMARY,
  APP_AUDIT,
  AUDIT_HISTORY_POINTS,
  LONG_AUDIT,
  PLAY_AUDIT,
  PROVISIONAL_AUDIT,
  METADATA_AUDIT,
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
  PENDING_PORTFOLIO_APP,
  INITIAL_APPS,
  PORTFOLIO,
  RATE_LIMIT_RESET_SECONDS,
  RECENT_CHANGES,
  WEBHOOKS,
  errorEnvelope,
  rateLimitedEnvelope,
} from "./fixtures.mts";
import type {
  AccountPlan,
  ActionItem,
  ActionSummary,
  AppAuditResult,
  WorkspaceTeam,
  ActionStatus,
  AuthUser,
  CompetitorAddRequest,
  CompetitorItem,
  EmailAlertCreateRequest,
  EmailAlertItem,
  FirstRunStatus,
  KeywordFieldRequest,
  KeywordAddRequest,
  KeywordFieldResult,
  KeywordSort,
  ParsedStoreUrl,
  StoreHealthReport,
  WorkspaceRunStatus,
  PortfolioSummary,
  TrackedKeywordItem,
  WebhookCreateRequest,
  WebhookItem,
  WorkspaceDeletionStatus,
} from "@asobeast/shared";
import {
  DELETION_CONFIRMATION,
  KEYWORD_BULK_ADD_LIMIT,
  KEYWORD_FIELD_BYTE_LIMIT,
  keywordFieldBytes,
  parseKeywordField,
  SESSION_COOKIE,
  SELF_HOSTED_LIMITS,
  UPGRADE_PATH,
  parseStoreUrl,
} from "@asobeast/shared";

const PORT = Number(process.env.MOCK_API_PORT ?? 4100);
const ERROR_ID = "err-app";
const MCP_STREAM_MS = 3_000;
const apps = [...INITIAL_APPS];
const KEYWORD_QUOTA_COOKIE = "e2e_keyword_quota";
const initialKeywords = new Map(
  Object.entries(DATASETS).map(([id, dataset]) => [
    id,
    structuredClone(dataset.keywords),
  ]),
);

function resetKeywords(): void {
  for (const [id, keywords] of initialKeywords) {
    DATASETS[id].keywords = structuredClone(keywords);
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
const actions: ActionItem[] = ACTIONS.map((action) => structuredClone(action));
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
  },
};
const BILLING_COOKIE = "e2e_billing";
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
) => void;

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

function appRoute(
  pattern: RegExp,
  pick: (dataset: (typeof DATASETS)[string]) => unknown,
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
      json(res, 200, pick(dataset));
    },
  };
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
  const generatedAt = actionsGeneratedAt(req);
  if (!actionsUngenerated(req)) return { ...ACTION_SUMMARY, generatedAt };
  return { ...ACTION_SUMMARY, open: 0, generatedAt };
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

function firstRunFor(appId: string): FirstRunStatus {
  if (appId === "app-new") return FIRST_RUN_MID;
  if (appId === "app-2") return FIRST_RUN_UNSCHEDULED;
  return { ...FIRST_RUN_COMPLETE, appId };
}

const BUDGET_HOLD_COOKIE = "e2e_budget_hold";

const budgetHolds = new Map<string, PromiseWithResolvers<void>>();

function budgetHold(token: string): PromiseWithResolvers<void> {
  const existing = budgetHolds.get(token);
  if (existing) return existing;
  const hold = Promise.withResolvers<void>();
  budgetHolds.set(token, hold);
  return hold;
}

const routes: Route[] = [
  {
    method: "POST",
    pattern: /^\/__reset\/keywords$/,
    handler: (_p, _req, res) => {
      resetKeywords();
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
    handler: (params, _q, res) => json(res, 200, firstRunFor(params[0])),
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
      json(res, 200, AUTH_USER);
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
      json(res, 200, {
        ...PORTFOLIO,
        apps: empty ? [] : portfolioApps,
        groups: empty ? [] : PORTFOLIO.groups,
        totals: {
          ...PORTFOLIO.totals,
          apps: empty ? 0 : portfolioApps.length,
        },
      } satisfies PortfolioSummary);
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
    pattern: /^\/jobs\/budget$/,
    handler: (_p, req, res) => {
      const token = cookieValue(req, BUDGET_HOLD_COOKIE);
      if (!token) {
        json(res, 200, BUDGET);
        return;
      }
      void budgetHold(token).promise.then(() => json(res, 200, BUDGET));
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
  appRoute(/^\/apps\/([^/]+)$/, (dataset) => dataset.detail),
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
      json(res, 200, sortKeywords(scoped, query.get("sort")));
    },
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/metadata\/audit$/,
    handler: ([id], req, res) =>
      apps.some((app) => app.id === id)
        ? json(res, 200, { ...METADATA_AUDIT, appId: id })
        : json(res, 404, errorEnvelope(404, req.url ?? "/", "App not found")),
  },
  {
    method: "GET",
    pattern: /^\/metadata\/assistant$/,
    handler: (_p, _q, res) =>
      json(res, 200, { configured: false, model: null }),
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
      if (id === "app-1") return json(res, 200, APP_1_KEYWORD_COUNTRIES);
      json(res, 200, [
        {
          country: dataset.detail.country,
          keywordCount: dataset.keywords.length,
        },
      ]);
    },
  },
  appRoute(/^\/apps\/([^/]+)\/changes$/, (dataset) => dataset.changes),
  appRoute(
    /^\/apps\/([^/]+)\/competitors\/discovery$/,
    (dataset) => dataset.discovery,
  ),
  appRoute(
    /^\/apps\/([^/]+)\/keywords\/compare$/,
    (dataset) => dataset.comparison,
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
    method: "PATCH",
    pattern: /^\/actions\/([^/]+)$/,
    handler: (params, req, res) => {
      withBody<{ status: ActionStatus; snoozedUntil?: string; note?: string }>(
        req,
        res,
        (body) => {
          const path = req.url ?? "/";
          const action = actions.find((row) => row.id === params[0]);
          if (!action) return json(res, 404, errorEnvelope(404, path));
          if (action.id === "act-degraded") {
            return json(res, 500, errorEnvelope(500, path));
          }
          action.status = body.status;
          action.snoozedUntil =
            body.status === "SNOOZED" ? (body.snoozedUntil ?? null) : null;
          action.closedAt =
            body.status === "DONE" || body.status === "DISMISSED"
              ? new Date().toISOString()
              : null;
          if (body.status === "OPEN") action.reopenCount += 1;
          json(res, 200, action);
        },
      );
    },
  },
  {
    method: "POST",
    pattern: /^\/apps\/([^/]+)\/refresh$/,
    handler: (_p, _q, res) =>
      json(res, 200, { snapshotId: "snap-1", changes: [] }),
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

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
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

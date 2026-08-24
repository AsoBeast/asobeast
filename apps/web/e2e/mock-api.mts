import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  ACTIONS,
  ACTION_SUMMARY,
  APP_AUDIT,
  METADATA_AUDIT,
  APP_1_KEYWORD_COUNTRIES,
  BUDGET,
  DATASETS,
  EMAIL_ALERTS,
  EMAIL_DELIVERIES,
  HEALTH,
  RUN_STATUS,
  IMPORTED_APP,
  IMPORTED_APP_DETAIL,
  IMPORTED_PORTFOLIO_APP,
  PENDING_PORTFOLIO_APP,
  INITIAL_APPS,
  PORTFOLIO,
  RECENT_CHANGES,
  WEBHOOKS,
  errorEnvelope,
} from "./fixtures.mts";
import type {
  AccountPlan,
  ActionItem,
  WorkspaceTeam,
  ActionStatus,
  AuthUser,
  KeywordSort,
  PortfolioSummary,
  TrackedKeywordItem,
} from "@asobeast/shared";
import {
  SESSION_COOKIE,
  SELF_HOSTED_LIMITS,
  UPGRADE_PATH,
} from "@asobeast/shared";

const PORT = Number(process.env.MOCK_API_PORT ?? 4100);
const ERROR_ID = "err-app";
const apps = [...INITIAL_APPS];
const actions: ActionItem[] = ACTIONS.map((action) => structuredClone(action));
const portfolioApps = [...PORTFOLIO.apps, PENDING_PORTFOLIO_APP];
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

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
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
      if (id === ERROR_ID) return json(res, 500, errorEnvelope(500, path));
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

const routes: Route[] = [
  {
    method: "POST",
    pattern: /^\/__reset$/,
    handler: (_p, _req, res) => {
      resetActions();
      json(res, 200, { reset: true });
    },
  },
  {
    method: "GET",
    pattern: /^\/health$/,
    handler: (_p, _q, res) => json(res, 200, HEALTH),
  },
  {
    method: "GET",
    pattern: /^\/jobs\/run-status$/,
    handler: (_p, _q, res) => json(res, 200, RUN_STATUS),
  },
  {
    method: "GET",
    pattern: /^\/auth\/status$/,
    handler: (_p, req, res) => {
      const setupRequired = hasCookie(req, "e2e_setup_required", "1");
      const authenticated = hasCookie(req, SESSION_COOKIE);
      json(res, 200, {
        billing: false,
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
    pattern: /^\/auth\/plan$/,
    handler: (_p, req, res) => {
      if (!hasCookie(req, SESSION_COOKIE)) {
        return json(res, 401, errorEnvelope(401, req.url ?? "/auth/plan"));
      }
      json(res, 200, ACCOUNT_PLAN);
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
      json(res, 200, hasCookie(req, "e2e-empty-alerts", "1") ? [] : WEBHOOKS),
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
        hasCookie(req, "e2e-empty-alerts", "1") ? [] : EMAIL_ALERTS,
      ),
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
    handler: (_p, _q, res) => json(res, 200, BUDGET),
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
  appRoute(/^\/apps\/([^/]+)\/summary$/, (dataset) => dataset.summary),
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
    handler: ([id], _q, res) =>
      apps.some((app) => app.id === id)
        ? json(res, 200, { ...METADATA_AUDIT, appId: id })
        : json(res, 404, errorEnvelope(404, "App not found")),
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
    handler: ([id], _q, res) =>
      apps.some((app) => app.id === id)
        ? json(res, 200, { ...APP_AUDIT, appId: id })
        : json(res, 404, errorEnvelope(404, "App not found")),
  },
  {
    method: "GET",
    pattern: /^\/apps\/([^/]+)\/audit\/history$/,
    handler: ([id], _q, res) =>
      apps.some((app) => app.id === id)
        ? json(res, 200, { points: [] })
        : json(res, 404, errorEnvelope(404, "App not found")),
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
  appRoute(
    /^\/apps\/([^/]+)\/ratings-history$/,
    (dataset) => dataset.ratingsHistory,
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
    handler: (_p, req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const items = filterActions(url);
      json(res, 200, {
        items,
        total: items.length,
        generatedAt: ACTION_SUMMARY.generatedAt,
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/actions\/summary$/,
    handler: (_p, _req, res) => json(res, 200, ACTION_SUMMARY),
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
    handler: (params, req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const items = filterActions(url, params[0]);
      json(res, 200, {
        items,
        total: items.length,
        generatedAt: ACTION_SUMMARY.generatedAt,
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/actions\/run$/,
    handler: (_p, _req, res) =>
      json(res, 202, { queued: true, jobId: "actions~ws_default~2026-07-30" }),
  },
  {
    method: "PATCH",
    pattern: /^\/actions\/([^/]+)$/,
    handler: (params, req, res) => {
      void readBody(req).then((raw) => {
        const path = req.url ?? "/";
        const action = actions.find((row) => row.id === params[0]);
        if (!action) return json(res, 404, errorEnvelope(404, path));
        if (action.id === "act-degraded") {
          return json(res, 500, errorEnvelope(500, path));
        }
        const body = JSON.parse(raw || "{}") as {
          status: ActionStatus;
          snoozedUntil?: string;
          note?: string;
        };
        action.status = body.status;
        action.snoozedUntil =
          body.status === "SNOOZED" ? (body.snoozedUntil ?? null) : null;
        action.closedAt =
          body.status === "DONE" || body.status === "DISMISSED"
            ? new Date().toISOString()
            : null;
        if (body.status === "OPEN") action.reopenCount += 1;
        json(res, 200, action);
      });
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

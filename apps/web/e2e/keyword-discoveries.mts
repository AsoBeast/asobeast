import {
  type ApiErrorEnvelope,
  DISCOVERY_CHECKS_PER_RUN,
  DISCOVERY_RECOMMENDED,
  type DiscoverySource,
  type KeywordDiscoveryDismissResult,
  type KeywordDiscoveryItem,
  type KeywordDiscoveryList,
  type KeywordDiscoveryRefreshResult,
  type KeywordDiscoverySettings,
  type KeywordDiscoveryTrackRequest,
  type KeywordDiscoveryTrackResult,
  type Store,
} from "@asobeast/shared";
import {
  APP_TRANSLATED_DISCOVERY_STATES_ID,
  APP_TRANSLATED_DISCOVERY_TRACK_ID,
  utcDaysAgo,
  utcTimestampDaysAgo,
} from "./fixtures.mts";

export const DISCOVERY_PENDING_COOKIE = "e2e_discovery_pending";
export const DISCOVERY_NONE_COOKIE = "e2e_discovery_none";
export const DISCOVERY_UNFIT_COOKIE = "e2e_discovery_unfit";
export const DISCOVERY_SPENT_COOKIE = "e2e_discovery_spent";
export const DISCOVERY_REFUSE_COOKIE = "e2e_discovery_refuse";
export const DISCOVERY_FAIL_WRITE_COOKIE = "e2e_discovery_fail_write";
export const DISCOVERY_SPIDER_LIMIT = 30;
export const DISCOVERY_COMPETITOR_REFUSAL =
  "A competitor app has no keyword discoveries; use its primary app";

export const DISCOVERY_COOKIE_PENDING = 3;
export const DISCOVERY_UNFIT = 12;
export const DISCOVERY_USED_THIS_WEEK = 12;
export const DISCOVERY_REFRESH_QUEUED = 8;
export const DISCOVERY_PAGED_APP = "app-bulk";
export const DISCOVERY_PAGED_ROWS = 120;

interface Seed {
  text: string;
  country: string;
  source: DiscoverySource;
  position?: number | null;
  depth?: number | null;
  traffic?: number | null;
  difficulty?: number | null;
  relevance?: number;
  opportunity?: number | null;
}

export const KEYWORD_DISCOVERIES_APP_1: readonly Seed[] = [
  {
    text: "focus timer app",
    country: "us",
    source: "title",
    position: 3,
    depth: 200,
    traffic: 5.2,
    difficulty: 4.1,
    relevance: 90,
    opportunity: 59,
  },
  {
    text: "pomodoro clock",
    country: "us",
    source: "subtitle",
    position: 45,
    depth: 50,
    relevance: 90,
  },
  {
    text: "deep work",
    country: "us",
    source: "competitors",
    position: 120,
    depth: 200,
    traffic: 3.1,
    relevance: 70,
  },
  {
    text: "study planner",
    country: "us",
    source: "reviews",
    position: null,
    depth: 200,
    traffic: 6.5,
    difficulty: 5.9,
    relevance: 72,
    opportunity: 41,
  },
  {
    text: "time blocker",
    country: "us",
    source: "popularity",
    position: null,
    depth: 200,
    traffic: 7,
    relevance: 66,
  },
  { text: "productivity tracker", country: "us", source: "portfolio" },
  { text: "work sprint", country: "us", source: "title", relevance: 90 },
  {
    text: "concentration",
    country: "us",
    source: "description",
    position: null,
    depth: 50,
    relevance: 70,
  },
  {
    text: "focus music",
    country: "us",
    source: "reviews",
    position: null,
    depth: 200,
    traffic: 2,
    difficulty: 7,
    relevance: 50,
    opportunity: 18,
  },
  {
    text: "minutnik skupienia",
    country: "pl",
    source: "portfolio",
    position: 12,
    depth: 200,
  },
  { text: "timer do nauki", country: "pl", source: "competitors" },
];

const PLAY_SEEDS: readonly Seed[] = [
  {
    text: "habit timer",
    country: "de",
    source: "title",
    position: 8,
    depth: 200,
  },
  {
    text: "daily focus",
    country: "de",
    source: "description",
    position: null,
    depth: 200,
  },
  {
    text: "routine app",
    country: "de",
    source: "competitors",
    position: 40,
    depth: 200,
  },
  {
    text: "focus streak",
    country: "de",
    source: "reviews",
    position: null,
    depth: 200,
  },
];

const PAGED_SEEDS: readonly Seed[] = Array.from(
  { length: DISCOVERY_PAGED_ROWS },
  (_, index) => ({
    text: `discovered phrase ${String(index + 1).padStart(3, "0")}`,
    country: "us",
    source: "title" as const,
    position: index < 30 ? index + 1 : null,
    depth: 200,
    relevance: 90 - Math.floor(index / 10),
  }),
);

export const DISCOVERY_SEAM_APP = "app-long";
export const DISCOVERY_FOCUS_APP = "app-2";

const SEEDS: Record<string, readonly Seed[]> = {
  "app-1": KEYWORD_DISCOVERIES_APP_1,
  [DISCOVERY_SEAM_APP]: KEYWORD_DISCOVERIES_APP_1,
  [DISCOVERY_FOCUS_APP]: KEYWORD_DISCOVERIES_APP_1,
  [APP_TRANSLATED_DISCOVERY_STATES_ID]: KEYWORD_DISCOVERIES_APP_1,
  [APP_TRANSLATED_DISCOVERY_TRACK_ID]: KEYWORD_DISCOVERIES_APP_1,
  "app-gp": PLAY_SEEDS,
  [DISCOVERY_PAGED_APP]: PAGED_SEEDS,
};

const OPPORTUNITY_HIGH = 35;
const OPPORTUNITY_MIN_RELEVANCE = 60;

const stateOf = (
  seed: Seed,
  opportunity: number | null,
  relevance: number,
): KeywordDiscoveryItem["state"] => {
  if (seed.position !== undefined && seed.position !== null) return "ranked";
  return relevance >= OPPORTUNITY_MIN_RELEVANCE &&
    opportunity !== null &&
    opportunity >= OPPORTUNITY_HIGH
    ? "opportunity"
    : "open";
};

const itemOf = (appId: string, seed: Seed): KeywordDiscoveryItem => {
  const relevance = seed.relevance ?? 60;
  const opportunity = seed.opportunity ?? null;
  const traffic = seed.traffic ?? null;
  const depth = seed.depth ?? null;
  return {
    keywordId: `disc-${appId}-${seed.country}-${seed.text.replaceAll(" ", "-")}`,
    text: seed.text,
    country: seed.country,
    source: seed.source,
    position: seed.position ?? null,
    depth,
    checkedOn: depth === null ? null : utcDaysAgo(3),
    traffic,
    difficulty: seed.difficulty ?? null,
    volume: traffic === null ? null : Math.round(traffic * 10),
    relevance,
    opportunity,
    state: stateOf(seed, opportunity, relevance),
    recommended: false,
  };
};

interface AppDiscoveries {
  items: KeywordDiscoveryItem[];
  autoTrackRanked: boolean;
  usedThisWeek: number;
  pendingReads: number[];
  cookiePendingServed: boolean;
}

const state = new Map<string, AppDiscoveries>();

function seeded(appId: string): AppDiscoveries {
  const known = state.get(appId);
  if (known) return known;
  const seeds = SEEDS[appId] ?? [];
  const fresh: AppDiscoveries = {
    items: seeds.map((seed) => itemOf(appId, seed)),
    autoTrackRanked: false,
    usedThisWeek: seeds.length > 0 ? DISCOVERY_USED_THIS_WEEK : 0,
    pendingReads: [],
    cookiePendingServed: false,
  };
  state.set(appId, fresh);
  return fresh;
}

export interface DiscoveryVariant {
  pending: boolean;
  none: boolean;
  unfit: boolean;
}

const MONDAY = 1;
const WEEKLY_RUN_HOUR = 7;
const WEEKLY_RUN_MINUTE = 30;

function nextWeeklyRun(now: Date): string {
  const next = new Date(now);
  next.setUTCHours(WEEKLY_RUN_HOUR, WEEKLY_RUN_MINUTE, 0, 0);
  const days = (MONDAY - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + days);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}

function pendingOf(discoveries: AppDiscoveries, variant: DiscoveryVariant) {
  if (variant.pending && !discoveries.cookiePendingServed) {
    discoveries.cookiePendingServed = true;
    return DISCOVERY_COOKIE_PENDING;
  }
  return discoveries.pendingReads.shift() ?? 0;
}

function unfitOf(
  variant: DiscoveryVariant,
  autoTrackRanked: boolean,
  ranked: number,
): number {
  if (variant.unfit) return DISCOVERY_UNFIT;
  return autoTrackRanked ? ranked : 0;
}

export function discoveriesFor(
  appId: string,
  store: Store,
  country: string | null,
  variant: DiscoveryVariant,
): KeywordDiscoveryList {
  const discoveries = seeded(appId);
  const pending = pendingOf(discoveries, variant);
  const scoped = variant.none
    ? []
    : discoveries.items.filter(
        (item) => country === null || item.country === country,
      );
  const items = scoped.map((item, index) => ({
    ...item,
    recommended: index < DISCOVERY_RECOMMENDED,
  }));
  const counted = (rowState: KeywordDiscoveryItem["state"]) =>
    items.filter((item) => item.state === rowState).length;
  const counts = {
    all: items.length,
    ranked: counted("ranked"),
    opportunity: counted("opportunity"),
  };
  const autoTrackRanked = variant.unfit || discoveries.autoTrackRanked;
  return {
    items,
    counts,
    autoTrackRanked,
    unfit: unfitOf(variant, autoTrackRanked, counts.ranked),
    checks: {
      perWeek: DISCOVERY_CHECKS_PER_RUN[store],
      usedThisWeek: variant.none ? 0 : discoveries.usedThisWeek,
      pending,
      checkedAt: variant.none ? null : utcTimestampDaysAgo(3),
      nextRunAt: nextWeeklyRun(new Date()),
    },
  };
}

function removeRows(
  discoveries: AppDiscoveries,
  keep: (item: KeywordDiscoveryItem) => boolean,
): number {
  const before = discoveries.items.length;
  discoveries.items = discoveries.items.filter(keep);
  return before - discoveries.items.length;
}

const UNFIT_ROOM = 1;

export function trackDiscoveries(
  appId: string,
  request: KeywordDiscoveryTrackRequest,
  unfit: boolean,
): KeywordDiscoveryTrackResult {
  const discoveries = seeded(appId);
  if (request.allRanked) {
    const ranked = discoveries.items.filter(
      (item) =>
        item.state === "ranked" &&
        (request.country === undefined || item.country === request.country),
    );
    const fits = new Set(
      ranked
        .slice(0, unfit ? UNFIT_ROOM : ranked.length)
        .map(({ keywordId }) => keywordId),
    );
    const tracked = removeRows(
      discoveries,
      (item) => !fits.has(item.keywordId),
    );
    return { tracked, skipped: ranked.length - tracked };
  }
  const ids = new Set(request.keywordIds ?? []);
  const tracked = removeRows(discoveries, (item) => !ids.has(item.keywordId));
  return { tracked, skipped: 0 };
}

export function dismissDiscoveries(
  appId: string,
  keywordIds: readonly string[],
): KeywordDiscoveryDismissResult {
  const ids = new Set(keywordIds);
  return {
    dismissed: removeRows(seeded(appId), (item) => !ids.has(item.keywordId)),
  };
}

export function refreshDiscoveries(
  appId: string,
  spent: boolean,
): KeywordDiscoveryRefreshResult {
  const discoveries = seeded(appId);
  if (spent) return { queued: 0, resolved: 2 };
  discoveries.usedThisWeek += DISCOVERY_REFRESH_QUEUED;
  discoveries.pendingReads = [DISCOVERY_REFRESH_QUEUED];
  return { queued: DISCOVERY_REFRESH_QUEUED, resolved: 1 };
}

export function setDiscoverySettings(
  appId: string,
  autoTrackRanked: boolean,
): KeywordDiscoverySettings {
  const discoveries = seeded(appId);
  discoveries.autoTrackRanked = autoTrackRanked;
  const tracked = autoTrackRanked
    ? removeRows(discoveries, (item) => item.state !== "ranked")
    : 0;
  return { autoTrackRanked, tracked, skipped: 0 };
}

export function resetDiscoveries(appId?: string): void {
  if (appId === undefined) state.clear();
  else state.delete(appId);
}

export function spiderRefusedEnvelope(path: string): ApiErrorEnvelope {
  return {
    statusCode: 429,
    error: "Too Many Requests",
    message: `Deep search limit reached: the indie plan allows ${DISCOVERY_SPIDER_LIMIT} requests per hour. Wait 4 seconds before the next one, because retrying before then will fail.`,
    path,
    timestamp: new Date().toISOString(),
    rateLimit: {
      window: "hour",
      rateClass: "store",
      plan: "indie",
      limit: DISCOVERY_SPIDER_LIMIT,
      resetSeconds: 4,
      upgradeTo: "ultimate",
      action: "spider",
    },
    retryAfterSeconds: 4,
  };
}

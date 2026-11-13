import {
  ALERT_FEED_EVENTS,
  isAlertFeedEvent,
  QUERY_BOUNDS,
  RANK_DEPTH,
  type AlertEventItem,
  type AlertEventList,
  type AlertFeedEvent,
  type ChartMoveScope,
  type GranularAlertPayload,
  type KeywordScope,
} from "@asobeast/shared";

export const ALERT_FEED_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-alert-feed/512x512bb.png";

export const ALERT_EVENTS_COOKIE = "e2e_alert_events";

export const ALERT_EVENTS_SLOW_MS = 1500;

export const ALERT_EVENT_PAGE_SIZE = QUERY_BOUNDS.alertEventsLimit.default;

export const LONG_ALERT_KEYWORD =
  "pomodoro focus timer for deep work sessions with breaks and daily statistics";

export const ARABIC_REVIEW_TEXT =
  "التطبيق يتوقف عند الفتح بعد التحديث الأخير ولا يمكنني استخدامه";

function at(daysAgo: number, time: string): string {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - daysAgo);
  return `${day.toISOString().slice(0, 10)}T${time}.000Z`;
}

const focusTimer = {
  id: "app-1",
  name: "Focus Timer",
  iconUrl: ALERT_FEED_ICON_URL,
  store: "APP_STORE" as const,
  country: "us",
};

const tomatoClock = {
  id: "app-gp",
  name: "Tomato Clock",
  iconUrl: null,
  store: "GOOGLE_PLAY" as const,
  country: "de",
};

const rivalFocus = {
  id: "comp-1",
  name: "Rival Focus",
  iconUrl: null,
  store: "APP_STORE" as const,
  country: "us",
};

const keyword = (
  id: string,
  text: string,
  country = "us",
  store: KeywordScope["store"] = "APP_STORE",
): KeywordScope => ({ id, text, store, country });

const productivityChart = (
  store: ChartMoveScope["store"],
  country: string,
): ChartMoveScope => ({
  store,
  country,
  collection: "free",
  genre: store === "APP_STORE" ? "6007" : "PRODUCTIVITY",
  genreName: "Productivity",
  device: store === "APP_STORE" ? "iphone" : "android",
});

interface ItemSeed {
  id: string;
  occurredAt: string;
  sentence: string;
  primaryAppId: string | null;
  payload: GranularAlertPayload & { event: AlertFeedEvent };
  country?: string | null;
}

function marketOf(payload: GranularAlertPayload): string | null {
  if ("chart" in payload) return payload.chart.country;
  if ("keyword" in payload && payload.keyword && "country" in payload.keyword) {
    return payload.keyword.country;
  }
  return "app" in payload ? (payload.app.country ?? null) : null;
}

function item(seed: ItemSeed): AlertEventItem {
  const app = "app" in seed.payload ? seed.payload.app : null;
  return {
    id: seed.id,
    event: seed.payload.event,
    occurredAt: seed.occurredAt,
    sentence: seed.sentence,
    appId: app?.id ?? null,
    appName: app?.name ?? null,
    iconUrl: app?.iconUrl ?? null,
    store: app?.store ?? null,
    country: seed.country ?? marketOf(seed.payload),
    primaryAppId: seed.primaryAppId,
    payload: seed.payload,
  };
}

const ONE_OF_EACH: Record<AlertFeedEvent, AlertEventItem> = {
  "metadata.changed": item({
    id: "evt-change-rival",
    occurredAt: at(0, "00:20:00"),
    sentence: "Rival Focus changed its subtitle",
    primaryAppId: "app-1",
    payload: {
      event: "metadata.changed",
      occurredAt: at(0, "00:20:00"),
      app: { ...rivalFocus, isCompetitor: true },
      changes: [
        {
          field: "subtitle",
          before: "Focus and study",
          after: "Deep work timer",
        },
      ],
    },
  }),
  "rank.dropped": item({
    id: "evt-drop-us",
    occurredAt: at(0, "00:15:00"),
    sentence: 'Focus Timer fell from #4 to #12 for "focus timer" in US',
    primaryAppId: "app-1",
    payload: {
      event: "rank.dropped",
      occurredAt: at(0, "00:15:00"),
      app: focusTimer,
      keyword: keyword("kw-1", "focus timer"),
      from: 4,
      to: 12,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  }),
  "rank.improved": item({
    id: "evt-gain-de",
    occurredAt: at(0, "00:10:00"),
    sentence: 'Focus Timer climbed from #20 to #7 for "pomodoro" in DE',
    primaryAppId: "app-1",
    payload: {
      event: "rank.improved",
      occurredAt: at(0, "00:10:00"),
      app: focusTimer,
      keyword: keyword("kw-de-1", "pomodoro", "de"),
      from: 20,
      to: 7,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  }),
  "rank.milestone": item({
    id: "evt-milestone",
    occurredAt: at(1, "08:00:00"),
    sentence:
      'Focus Timer entered the top 10 for "study timer" in US: #14 → #8',
    primaryAppId: "app-1",
    payload: {
      event: "rank.milestone",
      occurredAt: at(1, "08:00:00"),
      app: focusTimer,
      keyword: keyword("kw-3", "study timer"),
      tier: 10,
      direction: "entered",
      from: 14,
      to: 8,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
    },
  }),
  "rank.first": item({
    id: "evt-first",
    occurredAt: at(1, "07:30:00"),
    sentence:
      'Focus Timer ranks for "time blocking" in US for the first time, at #37',
    primaryAppId: "app-1",
    payload: {
      event: "rank.first",
      occurredAt: at(1, "07:30:00"),
      app: focusTimer,
      keyword: keyword("kw-5", "time blocking"),
      position: 37,
      depth: RANK_DEPTH,
    },
  }),
  "rank.overtaken": item({
    id: "evt-overtaken",
    occurredAt: at(1, "07:00:00"),
    sentence:
      'Rival Focus overtook Focus Timer for "productivity app" in US: now #4 against #6',
    primaryAppId: "app-1",
    payload: {
      event: "rank.overtaken",
      occurredAt: at(1, "07:00:00"),
      app: focusTimer,
      keyword: keyword("kw-4", "productivity app"),
      competitor: { id: "comp-1", name: "Rival Focus", from: 9, to: 4 },
      from: 5,
      to: 6,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
    },
  }),
  "review.negative": item({
    id: "evt-review-arabic",
    occurredAt: at(1, "06:00:00"),
    sentence: `Tomato Clock got a 1 star review: "${ARABIC_REVIEW_TEXT}"`,
    primaryAppId: "app-gp",
    payload: {
      event: "review.negative",
      occurredAt: at(1, "06:00:00"),
      app: tomatoClock,
      review: {
        score: 1,
        title: null,
        text: ARABIC_REVIEW_TEXT,
        version: "2.1.0",
        reviewedAt: at(1, "05:00:00"),
      },
    },
  }),
  "serp.entrant": item({
    id: "evt-entrant",
    occurredAt: at(1, "05:00:00"),
    sentence: 'Calm Clock entered the top 10 for "pomodoro" in US at #6',
    primaryAppId: "app-1",
    payload: {
      event: "serp.entrant",
      occurredAt: at(1, "05:00:00"),
      keyword: keyword("kw-2", "pomodoro"),
      date: at(1, "05:00:00").slice(0, 10),
      entrants: [
        {
          position: 6,
          storeAppId: "998877",
          title: "Calm Clock",
          appId: null,
          isCompetitor: false,
        },
      ],
    },
  }),
  "action.opened": item({
    id: "evt-action",
    occurredAt: at(1, "04:00:00"),
    sentence:
      'New high priority action for Focus Timer: add "deep work" to the listing',
    primaryAppId: "app-1",
    payload: {
      event: "action.opened",
      occurredAt: at(1, "04:00:00"),
      app: focusTimer,
      action: {
        id: "act-uncovered",
        rule: "keyword.add_uncovered",
        category: "metadata",
        priority: "high",
        impact: 71,
        firstSeenAt: at(1, "04:00:00"),
        reopened: false,
      },
      keyword: { id: "kw-6", text: "deep work" },
      evidence: {
        rule: "keyword.add_uncovered",
        opportunity: 66.5,
        traffic: null,
        difficulty: null,
        volume: 62,
        relevance: 80,
        latestPosition: null,
        indexedFields: ["title", "subtitle", "keywordField"],
        uncoveredFields: ["title", "subtitle", "keywordField"],
        keywordFieldCharsFree: 18,
        scoreProvenance: null,
      },
      link: null,
    },
  }),
  "chart.entered": item({
    id: "evt-chart-gp",
    occurredAt: at(2, "12:00:00"),
    sentence: "Tomato Clock entered the Productivity free chart in DE at #48",
    primaryAppId: "app-gp",
    payload: {
      event: "chart.entered",
      occurredAt: at(2, "12:00:00"),
      app: tomatoClock,
      chart: productivityChart("GOOGLE_PLAY", "de"),
      date: at(2, "12:00:00").slice(0, 10),
      depth: 200,
      from: null,
      to: 48,
    },
  }),
  "chart.left": item({
    id: "evt-chart-left",
    occurredAt: at(2, "11:00:00"),
    sentence: "Focus Timer left the Productivity free chart in US",
    primaryAppId: "app-1",
    payload: {
      event: "chart.left",
      occurredAt: at(2, "11:00:00"),
      app: focusTimer,
      chart: productivityChart("APP_STORE", "us"),
      date: at(2, "11:00:00").slice(0, 10),
      depth: 100,
      from: 96,
      to: null,
    },
  }),
  "chart.milestone": item({
    id: "evt-chart-milestone",
    occurredAt: at(2, "10:00:00"),
    sentence:
      "Focus Timer entered the top 10 of the Productivity free chart in US: #13 → #9",
    primaryAppId: "app-1",
    payload: {
      event: "chart.milestone",
      occurredAt: at(2, "10:00:00"),
      app: focusTimer,
      chart: productivityChart("APP_STORE", "us"),
      date: at(2, "10:00:00").slice(0, 10),
      depth: 100,
      tier: 10,
      direction: "entered",
      from: 13,
      to: 9,
    },
  }),
  "rating.dropped": item({
    id: "evt-rating",
    occurredAt: at(2, "09:00:00"),
    sentence: "Focus Timer's rating fell from 4.7 to 4.5 in US",
    primaryAppId: "app-1",
    payload: {
      event: "rating.dropped",
      occurredAt: at(2, "09:00:00"),
      app: focusTimer,
      country: "us",
      from: 4.71,
      to: 4.49,
      fromCount: 1200,
      toCount: 1260,
      fromDate: at(9, "00:00:00").slice(0, 10),
      toDate: at(2, "00:00:00").slice(0, 10),
      dropTenths: 2,
      version: null,
      actionId: null,
    },
  }),
  "review.spike": item({
    id: "evt-spike",
    occurredAt: at(2, "08:00:00"),
    sentence: "Tomato Clock got 34 reviews in one day, about 8 times its usual",
    primaryAppId: "app-gp",
    payload: {
      event: "review.spike",
      occurredAt: at(2, "08:00:00"),
      app: tomatoClock,
      date: at(3, "00:00:00").slice(0, 10),
      count: 34,
      median: 4,
      threshold: 12,
      lowShare: 0.71,
      lowScoreMax: 2,
      topTheme: { phrase: "crash on launch", kind: "complaint", mentions: 9 },
    },
  }),
  "app.delisted": item({
    id: "evt-delisted",
    occurredAt: at(2, "07:00:00"),
    sentence: "Rival Focus is no longer listed on the App Store",
    primaryAppId: "app-1",
    payload: {
      event: "app.delisted",
      occurredAt: at(2, "07:00:00"),
      app: { ...rivalFocus, isCompetitor: true },
      store: "APP_STORE",
      country: "us",
      date: at(2, "07:00:00").slice(0, 10),
    },
  }),
  "app.unlisted_market": item({
    id: "evt-unlisted",
    occurredAt: at(2, "06:00:00"),
    sentence:
      "Focus Timer is no longer listed in DE, where 12 keywords are tracked",
    primaryAppId: "app-1",
    country: "de",
    payload: {
      event: "app.unlisted_market",
      occurredAt: at(2, "06:00:00"),
      app: { ...focusTimer, isCompetitor: false },
      store: "APP_STORE",
      country: "us",
      market: "de",
      date: at(2, "06:00:00").slice(0, 10),
      trackedKeywords: 12,
    },
  }),
};

const EDGE_ITEMS: AlertEventItem[] = [
  item({
    id: "evt-entrant-orphan",
    occurredAt: at(1, "00:00:01"),
    sentence: 'Calm Clock entered the top 10 for "timer" in GB at #9',
    primaryAppId: null,
    payload: {
      event: "serp.entrant",
      occurredAt: at(1, "00:00:01"),
      keyword: keyword("kw-orphan", "timer", "gb"),
      date: at(1, "00:00:01").slice(0, 10),
      entrants: [
        {
          position: 9,
          storeAppId: "998877",
          title: "Calm Clock",
          appId: null,
          isCompetitor: false,
        },
      ],
    },
  }),
  item({
    id: "evt-long-keyword",
    occurredAt: at(2, "23:59:59"),
    sentence: `Focus Timer fell from #3 to #41 for "${LONG_ALERT_KEYWORD}" in US`,
    primaryAppId: "app-1",
    payload: {
      event: "rank.dropped",
      occurredAt: at(2, "23:59:59"),
      app: focusTimer,
      keyword: keyword("kw-long", LONG_ALERT_KEYWORD),
      from: 3,
      to: 41,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  }),
  item({
    id: "evt-cafe",
    occurredAt: at(0, "00:05:00"),
    sentence: 'Focus Timer climbed from #18 to #9 for "café timer" in FR',
    primaryAppId: "app-1",
    payload: {
      event: "rank.improved",
      occurredAt: at(0, "00:05:00"),
      app: focusTimer,
      keyword: keyword("kw-fr-1", "café timer", "fr"),
      from: 18,
      to: 9,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  }),
];

const FILLER_KEYWORDS = ["focus timer", "pomodoro", "study timer"] as const;

function fillerItem(index: number): AlertEventItem {
  const daysAgo = 3;
  const minute = String(59 - index).padStart(2, "0");
  const occurredAt = at(daysAgo, `20:${minute}:00`);
  const text = FILLER_KEYWORDS[index % FILLER_KEYWORDS.length];
  const country = index % 2 === 0 ? "us" : "de";
  const dropped = index % 3 !== 0;
  const from = dropped ? 5 + (index % 4) : 30 + index;
  const to = dropped ? 15 + index : 10 + (index % 5);
  const words = dropped ? "fell from" : "climbed from";
  const common = {
    occurredAt,
    app: focusTimer,
    keyword: keyword(`kw-filler-${index % 3}-${country}`, text, country),
    from,
    to,
    fromDepth: RANK_DEPTH,
    toDepth: RANK_DEPTH,
    threshold: 5,
  };
  return item({
    id: `evt-filler-${String(index).padStart(2, "0")}`,
    occurredAt,
    sentence: `Focus Timer ${words} #${from} to #${to} for "${text}" in ${country.toUpperCase()}`,
    primaryAppId: "app-1",
    payload: dropped
      ? { ...common, event: "rank.dropped" }
      : { ...common, event: "rank.improved" },
  });
}

const FILLER_COUNT = 41;

export const ALERT_EVENT_ITEMS: AlertEventItem[] = [
  ...Object.values(ONE_OF_EACH),
  ...EDGE_ITEMS,
  ...Array.from({ length: FILLER_COUNT }, (_, index) => fillerItem(index)),
].sort(
  (left, right) =>
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.id.localeCompare(left.id),
);

export const NEWEST_ALERT_EVENT = ALERT_EVENT_ITEMS[0];

export const QUIET_ALERT_APP_ID = "app-2";

const KNOWN_APPS = new Set([
  ...ALERT_EVENT_ITEMS.flatMap((entry) => [entry.appId, entry.primaryAppId]),
  QUIET_ALERT_APP_ID,
]);

const CURSOR_PREFIX = "c";

export type AlertFeedAnswer =
  | { status: 200; body: AlertEventList }
  | { status: 400 | 404; message: string };

function typesOf(query: URLSearchParams): AlertFeedEvent[] | string {
  const names = query
    .getAll("type")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const unknown = names.find((name) => !isAlertFeedEvent(name));
  if (unknown !== undefined) return `type ${unknown} is not an alert event`;
  return names.length > 0
    ? names.filter(isAlertFeedEvent)
    : [...ALERT_FEED_EVENTS];
}

function pageWindow(query: URLSearchParams): [number, number] | string {
  const { min, max } = QUERY_BOUNDS.alertEventsLimit;
  const limit = Number(query.get("limit") ?? ALERT_EVENT_PAGE_SIZE);
  if (!Number.isInteger(limit) || limit < min || limit > max) {
    return `limit must be between ${min} and ${max}`;
  }
  const cursor = query.get("cursor");
  if (cursor === null) return [0, limit];
  const start = Number(cursor.slice(CURSOR_PREFIX.length));
  if (!cursor.startsWith(CURSOR_PREFIX) || !Number.isInteger(start)) {
    return "cursor is not valid";
  }
  return [start, limit];
}

export function filterAlertEvents(
  items: readonly AlertEventItem[],
  query: URLSearchParams,
): AlertFeedAnswer {
  const types = typesOf(query);
  if (typeof types === "string") return { status: 400, message: types };
  const window = pageWindow(query);
  if (typeof window === "string") return { status: 400, message: window };
  const appId = query.get("appId");
  if (appId !== null && !KNOWN_APPS.has(appId)) {
    return { status: 404, message: `App ${appId} not found` };
  }
  const since = query.get("since");
  const matching = items.filter(
    (entry) =>
      types.includes(entry.event) &&
      (appId === null ||
        entry.appId === appId ||
        entry.primaryAppId === appId) &&
      (since === null || entry.occurredAt > new Date(since).toISOString()),
  );
  const [start, limit] = window;
  const end = start + limit;
  return {
    status: 200,
    body: {
      events: matching.slice(start, end),
      nextCursor: end < matching.length ? `${CURSOR_PREFIX}${end}` : null,
    },
  };
}

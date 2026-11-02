import type {
  ChartMovement,
  KeywordBreakdownSegment,
  KeywordWordMatch,
  SerpEntryItem,
  SerpExitItem,
  SerpSnapshot,
  SerpTitleMatch,
} from "@asobeast/shared";
import { utcDaysAgo } from "./fixtures.mts";

export const SERP_ICON_URLS = [1, 2, 3, 4].map(
  (index) =>
    `https://is1-ssl.mzstatic.com/image/thumb/e2e-serp-${index}/100x100bb.jpg`,
);

export const SERP_PLAY_ICON_URL =
  "https://play-lh.googleusercontent.com/e2e-serp-play=s100";

export const SERP_HISTORY_DAYS = [0, 1, 2].map(utcDaysAgo);

export const SERP_TRACKABLE = {
  position: 12,
  storeAppId: "777000012",
  title: "Exam Countdown Timer",
} as const;

interface Seed {
  storeAppId: string;
  title: string;
  developer?: string | null;
  iconUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  appId?: string | null;
  isCompetitor?: boolean;
  previous?: number | null;
  movement?: ChartMovement;
}

const fold = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function wordMatch(run: string, words: readonly string[]): KeywordWordMatch {
  if (words.includes(run.toLowerCase())) return "exact";
  return words.includes(fold(run)) ? "folded" : "none";
}

function segmentsOf(
  title: string,
  words: readonly string[],
): KeywordBreakdownSegment[] {
  const segments: KeywordBreakdownSegment[] = [];
  for (const run of title.split(/([\p{L}\p{N}]+)/u).filter(Boolean)) {
    const match = wordMatch(run, words);
    const last = segments.at(-1);
    if (last?.match === match) last.text += run;
    else segments.push({ text: run, match });
  }
  return segments;
}

function titleMatchOf(
  title: string,
  keyword: string,
  words: readonly string[],
): SerpTitleMatch {
  if (title.toLowerCase().includes(keyword)) return "phrase";
  const runs = title.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const found = words.filter((word) => runs.includes(word)).length;
  if (found === words.length) return "words";
  return found > 0 ? "partial" : "none";
}

function deltaOf(position: number, previous: number | null): number | null {
  return previous === null ? null : position - previous;
}

function movementOf(delta: number | null): ChartMovement {
  if (delta === null) return "new";
  if (delta < 0) return "up";
  return delta > 0 ? "down" : "same";
}

function entryOf(
  keyword: string,
  seed: Seed,
  position: number,
  compared: boolean,
): SerpEntryItem {
  const words = keyword.split(" ");
  const previous = !compared
    ? null
    : seed.previous === undefined
      ? position
      : seed.previous;
  const delta = deltaOf(position, previous);
  return {
    position,
    storeAppId: seed.storeAppId,
    title: seed.title,
    developer: seed.developer === undefined ? "Indie Studio" : seed.developer,
    ratingAvg: seed.ratingAvg === undefined ? 4.4 : seed.ratingAvg,
    ratingCount:
      seed.ratingCount === undefined ? position * 1000 : seed.ratingCount,
    appId: seed.appId ?? null,
    isCompetitor: seed.isCompetitor ?? false,
    iconUrl:
      seed.iconUrl === undefined
        ? SERP_ICON_URLS[position % SERP_ICON_URLS.length]
        : seed.iconUrl,
    titleMatch: titleMatchOf(seed.title, keyword, words),
    titleSegments: segmentsOf(seed.title, words),
    previous,
    delta,
    movement: compared ? (seed.movement ?? movementOf(delta)) : "none",
  };
}

const exitOf = (seed: Seed, previous: number): SerpExitItem => ({
  previous,
  storeAppId: seed.storeAppId,
  title: seed.title,
  developer: seed.developer ?? "Indie Studio",
  iconUrl: seed.iconUrl ?? SERP_ICON_URLS[0],
  appId: null,
  isCompetitor: false,
});

interface Day {
  keywordId: string;
  keyword: string;
  date: string;
  comparedTo: string | null;
  seeds: readonly Seed[];
  exits?: SerpExitItem[];
  dates: string[];
}

function snapshotOf({
  keywordId,
  keyword,
  date,
  comparedTo,
  seeds,
  exits = [],
  dates,
}: Day): SerpSnapshot {
  return {
    keywordId,
    text: keyword,
    date,
    entries: seeds.map((seed, index) =>
      entryOf(keyword, seed, index + 1, comparedTo !== null),
    ),
    comparedTo,
    exits,
    dates,
  };
}

const filler = (from: number, to: number, title: string): Seed[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    storeAppId: `777000${String(from + index).padStart(3, "0")}`,
    title: `${title} ${from + index}`,
  }));

const STUDY_TIMER = "study timer";

const STUDY_TOP_TEN: Seed[] = [
  { storeAppId: "777000001", title: "Study Timer Pro", ratingCount: 24000 },
  {
    storeAppId: "777000002",
    title: "Study Timer & Focus",
    previous: 4,
    ratingCount: 900,
  },
  {
    storeAppId: "777000003",
    title: "Study Timer Plus",
    previous: null,
    ratingCount: 100,
  },
  {
    storeAppId: "comp-store",
    title: "Rival Study Timer",
    appId: "comp-1",
    isCompetitor: true,
    previous: 3,
    ratingCount: 12000,
  },
  {
    storeAppId: "777000005",
    title: "Study Timer Daily",
    previous: 2,
    iconUrl: null,
  },
  { storeAppId: "777000006", title: "Timer for Study Sessions", previous: 5 },
  {
    storeAppId: "123456789",
    title: "Focus Timer",
    developer: "Focus Labs",
    ratingAvg: 4.8,
    appId: "app-1",
  },
  { storeAppId: "777000008", title: "Study Timer Kit" },
  { storeAppId: "777000009", title: "Study Timer Go" },
  { storeAppId: "777000010", title: "Pomodoro Clock" },
];

const STUDY_DEEP: Seed[] = [
  { storeAppId: "777000011", title: "Deep Study Planner" },
  { ...SERP_TRACKABLE, developer: "Countdown Co" },
  ...filler(13, 14, "Study Notes"),
  { storeAppId: "777000015", title: "Stúdy Timer Lite" },
  ...filler(16, 19, "Study Notes"),
  { storeAppId: "777000020", title: "مؤقت الدراسة", developer: "استوديو" },
  ...filler(21, 29, "Study Notes"),
  {
    storeAppId: "777000030",
    title: "Late Study Timer",
    movement: "none",
    previous: null,
  },
  ...filler(31, 50, "Study Notes"),
];

const STUDY_GONE: Seed = {
  storeAppId: "777000099",
  title: "Old Study Timer",
  developer: "Gone Apps",
};

const [TODAY, YESTERDAY, DAY_BEFORE] = SERP_HISTORY_DAYS;

const withoutMovement = ({
  storeAppId,
  title,
  developer,
  iconUrl,
  ratingAvg,
  ratingCount,
  appId,
  isCompetitor,
}: Seed): Seed => ({
  storeAppId,
  title,
  developer,
  iconUrl,
  ratingAvg,
  ratingCount,
  appId,
  isCompetitor,
});

const STUDY_YESTERDAY: Seed[] = [
  STUDY_TOP_TEN[0],
  STUDY_TOP_TEN[4],
  STUDY_TOP_TEN[3],
  STUDY_TOP_TEN[1],
  STUDY_TOP_TEN[5],
  STUDY_GONE,
  ...STUDY_TOP_TEN.slice(6),
  ...STUDY_DEEP.slice(0, 19),
  ...filler(130, 130, "Study Notes"),
  ...STUDY_DEEP.slice(20),
].map(withoutMovement);

const studyDay = (day: Omit<Day, "keywordId" | "keyword" | "dates">) =>
  snapshotOf({
    keywordId: "kw-3",
    keyword: STUDY_TIMER,
    dates: SERP_HISTORY_DAYS,
    ...day,
  });

const STUDY_TIMER_HISTORY: SerpSnapshot[] = [
  studyDay({
    date: TODAY,
    comparedTo: YESTERDAY,
    seeds: [...STUDY_TOP_TEN, ...STUDY_DEEP],
    exits: [exitOf(STUDY_GONE, 6)],
  }),
  studyDay({ date: YESTERDAY, comparedTo: DAY_BEFORE, seeds: STUDY_YESTERDAY }),
  studyDay({
    date: DAY_BEFORE,
    comparedTo: null,
    seeds: STUDY_YESTERDAY.slice(0, 10),
  }),
];

const singleDay = (
  keywordId: string,
  keyword: string,
  date: string,
  seeds: Seed[],
): SerpSnapshot[] => [
  snapshotOf({
    keywordId,
    keyword,
    date,
    comparedTo: null,
    seeds,
    dates: [date],
  }),
];

const PLAY_SEEDS: Seed[] = Array.from({ length: 12 }, (_, index) => ({
  storeAppId: `com.example.pomodoro${index + 1}`,
  title:
    index % 3 === 0
      ? `Pomodoro Timer ${index + 1}`
      : `Focus Clock ${index + 1}`,
  ratingAvg: 4 + (index % 6) / 10,
  ratingCount: null,
  iconUrl: SERP_PLAY_ICON_URL,
}));

export const SERP_PLAY_AVERAGE =
  PLAY_SEEDS.slice(0, 10).reduce(
    (sum, seed) => sum + (seed.ratingAvg ?? 0),
    0,
  ) / 10;

export const SERP_HISTORY: Record<string, SerpSnapshot[]> = {
  "kw-3": STUDY_TIMER_HISTORY,
  "kw-4": singleDay(
    "kw-4",
    "productivity app",
    TODAY,
    filler(101, 150, "Productivity App"),
  ),
  "kw-5": singleDay(
    "kw-5",
    "time blocking",
    utcDaysAgo(10),
    filler(201, 230, "Time Blocking"),
  ),
  "kw-gp-1": singleDay("kw-gp-1", "pomodoro timer", TODAY, PLAY_SEEDS),
  "kw-unchecked-1": [
    {
      keywordId: "kw-unchecked-1",
      text: "geo guess game",
      date: null,
      entries: [],
      comparedTo: null,
      exits: [],
      dates: [],
    },
  ],
};

export function serpOnDay(
  history: readonly SerpSnapshot[],
  date: string | null,
): SerpSnapshot {
  const [newest] = history;
  if (date === null) return newest;
  return (
    history.find((snapshot) => snapshot.date === date) ?? {
      ...newest,
      date,
      entries: [],
      exits: [],
      comparedTo: null,
    }
  );
}

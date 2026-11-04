export const KEYWORD_ZONES = [
  "quickWins",
  "worthFighting",
  "easyPickings",
  "lowPriority",
] as const;

export type KeywordZone = (typeof KEYWORD_ZONES)[number];

export const isKeywordZone = (value: unknown): value is KeywordZone =>
  KEYWORD_ZONES.some((zone) => zone === value);

export interface ScorePair {
  popularity: number;
  difficulty: number;
}

export interface ZoneThresholds {
  popularity: number;
  difficulty: number;
}

export interface ZoneFilterValue {
  zone: KeywordZone;
  thresholds: ZoneThresholds;
}

export interface ZoneCounts {
  zones: Record<KeywordZone, number>;
  unplotted: number;
}

export const DEFAULT_ZONE_THRESHOLDS: ZoneThresholds = {
  popularity: 20,
  difficulty: 25,
};

export const ZONE_THRESHOLD_MIN = 0;
export const ZONE_THRESHOLD_MAX = 100;
export const ZONE_THRESHOLDS_KEY = "asobeast.map.thresholds";

export const ZONE_LABELS: Record<KeywordZone, string> = {
  quickWins: "Quick wins",
  worthFighting: "Worth fighting for",
  easyPickings: "Easy pickings",
  lowPriority: "Low priority",
};

const ZONE_MEANINGS: Record<KeywordZone, string> = {
  quickWins: "Easy enough to rank for and searched enough to matter.",
  worthFighting: "Searched a lot, and hard to rank for.",
  easyPickings: "Easy to rank for, but few people search for it.",
  lowPriority: "Hard to rank for and little searched.",
};

export function zoneOf(
  pair: ScorePair | null,
  thresholds: ZoneThresholds,
): KeywordZone | null {
  if (pair === null) return null;
  const popular = pair.popularity >= thresholds.popularity;
  const easy = pair.difficulty <= thresholds.difficulty;
  if (popular) return easy ? "quickWins" : "worthFighting";
  return easy ? "easyPickings" : "lowPriority";
}

export function zoneCounts(
  pairs: readonly (ScorePair | null)[],
  thresholds: ZoneThresholds,
): ZoneCounts {
  const zones: Record<KeywordZone, number> = {
    quickWins: 0,
    worthFighting: 0,
    easyPickings: 0,
    lowPriority: 0,
  };
  let unplotted = 0;
  for (const pair of pairs) {
    const zone = zoneOf(pair, thresholds);
    if (zone === null) unplotted += 1;
    else zones[zone] += 1;
  }
  return { zones, unplotted };
}

export function zoneRule(
  zone: KeywordZone,
  thresholds: ZoneThresholds,
): string {
  const popular = zone === "quickWins" || zone === "worthFighting";
  const easy = zone === "quickWins" || zone === "easyPickings";
  const popularity = popular
    ? `Popularity ${thresholds.popularity} or more`
    : `Popularity below ${thresholds.popularity}`;
  const difficulty = easy
    ? `difficulty ${thresholds.difficulty} or less`
    : `difficulty above ${thresholds.difficulty}`;
  return `${popularity} and ${difficulty}`;
}

export const zoneMeaning = (zone: KeywordZone): string => ZONE_MEANINGS[zone];

export const isZoneThreshold = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= ZONE_THRESHOLD_MIN &&
  value <= ZONE_THRESHOLD_MAX;

export function parseThresholdInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isZoneThreshold(value) ? value : null;
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseZoneThresholds(raw: string | null): ZoneThresholds {
  if (raw === null) return DEFAULT_ZONE_THRESHOLDS;
  const value = readJson(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_ZONE_THRESHOLDS;
  }
  const popularity: unknown = Reflect.get(value, "popularity");
  const difficulty: unknown = Reflect.get(value, "difficulty");
  return isZoneThreshold(popularity) && isZoneThreshold(difficulty)
    ? { popularity, difficulty }
    : DEFAULT_ZONE_THRESHOLDS;
}

export const serializeZoneThresholds = (thresholds: ZoneThresholds): string =>
  JSON.stringify({
    popularity: thresholds.popularity,
    difficulty: thresholds.difficulty,
  });

export const isDefaultThresholds = (thresholds: ZoneThresholds): boolean =>
  thresholds.popularity === DEFAULT_ZONE_THRESHOLDS.popularity &&
  thresholds.difficulty === DEFAULT_ZONE_THRESHOLDS.difficulty;

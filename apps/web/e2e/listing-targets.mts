import {
  keywordFieldLocalizations,
  LISTING_TARGET_LIMIT,
  targetSlotRole,
  type ListingTargetCandidate,
  type ListingTargetItem,
  type ListingTargetsRequest,
  type ListingTargetsResult,
  type ListingTargetsSaveResult,
  type TargetNotTracked,
  type TargetScores,
  type TrackedKeywordItem,
} from "@asobeast/shared";

export const TARGETS_FULL_COOKIE = "e2e_targets_full";
export const TARGETS_MOCK_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
export const TARGETS_PATH = /\/localizations\/[^/]+\/targets$/;

interface TargetState {
  slots: string[];
  updatedAt: string;
}

const stored = new Map<string, TargetState>();
const trackedByTargets = new Map<string, Set<string>>();
const resumedByTargets = new Map<string, Set<string>>();

const slotKey = (id: string, localization: string) => `${id}:${localization}`;
const pairKey = (country: string, text: string) =>
  JSON.stringify([country, text]);
const pairOf = (key: string): [string, string] => {
  const [country, text] = JSON.parse(key) as [string, string];
  return [country, text];
};
const normalized = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

export function resetListingTargets(id: string): void {
  for (const key of [...stored.keys()]) {
    if (key.startsWith(`${id}:`)) stored.delete(key);
  }
  trackedByTargets.delete(id);
  resumedByTargets.delete(id);
}

export function seedListingTargets(
  id: string,
  localization: string,
  slots: string[],
): void {
  stored.set(slotKey(id, localization), {
    slots,
    updatedAt: new Date().toISOString(),
  });
}

export const storedTargetSlots = (id: string, localization: string) =>
  stored.get(slotKey(id, localization))?.slots ?? [];

function readersOf(
  localization: string,
  home: string,
  keywords: readonly TrackedKeywordItem[],
): string[] {
  const markets = [
    home,
    ...[...new Set(keywords.map((row) => row.country))]
      .filter((country) => country !== home)
      .sort(),
  ];
  return markets.filter((country) =>
    keywordFieldLocalizations(country).some((tag) => tag === localization),
  );
}

function scoresOf(row: TrackedKeywordItem): TargetScores {
  return {
    country: row.country,
    keywordId: row.keywordId,
    popularity: row.traffic,
    difficulty: row.difficulty === null ? null : row.difficulty * 10,
    opportunity: row.opportunity,
    relevance: row.relevance,
    position: row.latestPosition,
    depth: row.latestDepth,
    checkedOn: row.latestCheckedOn ?? null,
    keywordClass: row.keywordClass,
  };
}

function rowsOf(
  id: string,
  keywords: readonly TrackedKeywordItem[],
): TrackedKeywordItem[] {
  const added = [...(trackedByTargets.get(id) ?? [])].map((pair) => {
    const [country, text] = pairOf(pair);
    return {
      keywordId: `target-${country}-${text}`,
      text,
      country,
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
      serpVolatility7d: null,
    } satisfies TrackedKeywordItem;
  });
  const resumed = resumedByTargets.get(id) ?? new Set<string>();
  const listed = keywords.map((row) =>
    resumed.has(pairKey(row.country, row.text))
      ? { ...row, active: true }
      : row,
  );
  return [...listed, ...added];
}

function itemOf(
  text: string,
  index: number,
  readers: readonly string[],
  rows: readonly TrackedKeywordItem[],
): ListingTargetItem {
  const held = readers.flatMap((country) =>
    rows.filter((row) => row.country === country && row.text === text),
  );
  const lead = held.find((row) => row.active) ?? held[0];
  return {
    position: index + 1,
    role: targetSlotRole(index),
    text,
    trackedIn: held.map(({ country, keywordId, active }) => ({
      country,
      keywordId,
      active,
    })),
    untrackedIn: readers.filter(
      (country) => !held.some((row) => row.country === country),
    ),
    lead: lead ? scoresOf(lead) : null,
  };
}

function candidatesOf(
  readers: readonly string[],
  rows: readonly TrackedKeywordItem[],
  taken: ReadonlySet<string>,
): ListingTargetCandidate[] {
  const brands = new Set(
    rows
      .filter((row) => row.keywordClass === "competitorBrand")
      .map((row) => row.text),
  );
  const groups = new Map<string, TrackedKeywordItem[]>();
  for (const country of readers) {
    for (const row of rows) {
      if (row.country !== country || !row.active) continue;
      if (taken.has(row.text) || brands.has(row.text)) continue;
      groups.set(row.text, [...(groups.get(row.text) ?? []), row]);
    }
  }
  return [...groups.entries()]
    .map(([text, held]) => ({
      text,
      markets: held.map((row) => row.country),
      lead: scoresOf(held[0]),
    }))
    .sort(
      (a, b) =>
        (b.lead.opportunity ?? -1) - (a.lead.opportunity ?? -1) ||
        (b.lead.popularity ?? -1) - (a.lead.popularity ?? -1) ||
        a.text.localeCompare(b.text),
    )
    .slice(0, 50);
}

export interface TargetsApp {
  id: string;
  localization: string;
  home: string;
  keywords: readonly TrackedKeywordItem[];
}

export function listingTargetsOf({
  id,
  localization,
  home,
  keywords,
}: TargetsApp): ListingTargetsResult {
  const rows = rowsOf(id, keywords);
  const readers = readersOf(localization, home, rows);
  const state = stored.get(slotKey(id, localization));
  const slots = Array.from(
    { length: LISTING_TARGET_LIMIT },
    (_, index) => state?.slots[index] || null,
  );
  return {
    appId: id,
    localization,
    readers,
    slots: slots.map((text, index) =>
      text === null ? null : itemOf(text, index, readers, rows),
    ),
    candidates: candidatesOf(
      readers,
      rows,
      new Set(slots.filter((text) => text !== null)),
    ),
    updatedAt: state?.updatedAt ?? null,
  };
}

export type TargetsSaveAnswer =
  | { status: 200; body: ListingTargetsSaveResult }
  | { status: 400; message: string };

function normalizedSlots(raw: readonly (string | null)[]): string[] | string {
  if (raw.length > LISTING_TARGET_LIMIT) {
    return `A localization takes at most ${LISTING_TARGET_LIMIT} target keywords, this list has ${raw.length}`;
  }
  const slots = raw.map((value) => (value === null ? "" : normalized(value)));
  for (const [index, text] of slots.entries()) {
    const first = slots.indexOf(text);
    if (text !== "" && first !== index) {
      return `Targets ${first + 1} and ${index + 1} are both "${text}"`;
    }
  }
  while (slots.at(-1) === "") slots.pop();
  return slots;
}

export function saveListingTargetsOf(
  app: TargetsApp,
  request: ListingTargetsRequest,
  full: boolean,
): TargetsSaveAnswer {
  const { id, localization, home, keywords } = app;
  const slots = normalizedSlots(request.slots);
  if (typeof slots === "string") return { status: 400, message: slots };
  const before = storedTargetSlots(id, localization);
  const rows = rowsOf(id, keywords);
  const readers = readersOf(localization, home, rows);
  const added = trackedByTargets.get(id) ?? new Set<string>();
  const resumed = resumedByTargets.get(id) ?? new Set<string>();
  const notTracked: TargetNotTracked[] = [];
  let tracked = 0;
  for (const text of slots) {
    if (text === "" || (!request.trackMissing && before.includes(text))) {
      continue;
    }
    for (const country of readers) {
      const row = rows.find(
        (candidate) => candidate.country === country && candidate.text === text,
      );
      if (row?.active) continue;
      if (full) {
        notTracked.push({ text, country, reason: "keywordLimit" });
        continue;
      }
      (row ? resumed : added).add(pairKey(country, text));
      tracked += 1;
    }
  }
  trackedByTargets.set(id, added);
  resumedByTargets.set(id, resumed);
  if (slots.length === 0) stored.delete(slotKey(id, localization));
  else seedListingTargets(id, localization, slots);
  return {
    status: 200,
    body: {
      ...listingTargetsOf(app),
      tracked,
      notTracked,
      quota: full
        ? { used: 25, limit: 25, upgradeTo: "ultimate" }
        : { used: 12, limit: 1000, upgradeTo: null },
    },
  };
}

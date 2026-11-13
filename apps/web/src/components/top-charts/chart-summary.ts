import type {
  CategoryCollection,
  ChartAppLink,
  ChartEntryItem,
  ChartPage,
} from "@asobeast/shared";
import { formatCountry, formatDate, formatDayMonth } from "@/lib/format";
import { COLLECTION_LABELS } from "./chart-params";

export interface MovementCounts {
  climbed: number;
  entered: number;
  held: number;
  fell: number;
}

const NO_MOVEMENT: MovementCounts = {
  climbed: 0,
  entered: 0,
  held: 0,
  fell: 0,
};

const COUNTED: Partial<
  Record<ChartEntryItem["movement"], keyof MovementCounts>
> = { up: "climbed", new: "entered", same: "held", down: "fell" };

export function movementCounts(
  entries: readonly Pick<ChartEntryItem, "movement">[],
): MovementCounts {
  const counts = { ...NO_MOVEMENT };
  for (const { movement } of entries) {
    const key = COUNTED[movement];
    if (key) counts[key] += 1;
  }
  return counts;
}

export function movementTotal(counts: MovementCounts): number {
  return counts.climbed + counts.entered + counts.held + counts.fell;
}

export function movementText(counts: MovementCounts): string {
  return [
    `${counts.climbed} climbed`,
    `${counts.entered} new`,
    `${counts.held} held`,
    `${counts.fell} fell`,
  ].join(", ");
}

type SummaryPage = Pick<
  ChartPage,
  "chart" | "capture" | "comparison" | "entries" | "apps" | "dates"
>;

export interface LedePart {
  text: string;
  strong?: boolean;
  app?: boolean;
}

interface Standing {
  entry: ChartEntryItem;
  collection: CategoryCollection;
  since: string | null;
}

function linksOf(
  pages: readonly Pick<ChartPage, "apps">[],
): Map<string, ChartAppLink> {
  return new Map(
    pages.flatMap((page) => page.apps.map((link) => [link.storeAppId, link])),
  );
}

export function ownStanding(pages: readonly SummaryPage[]): Standing | null {
  for (const page of pages) {
    const own = new Set(
      page.apps
        .filter((link) => link.role === "own")
        .map((link) => link.storeAppId),
    );
    const entry = [...page.entries]
      .sort((a, b) => a.position - b.position)
      .find((candidate) => own.has(candidate.storeAppId));
    if (entry) {
      return {
        entry,
        collection: page.chart.collection,
        since: page.comparison?.date ?? null,
      };
    }
  }
  return null;
}

function standingText({ entry, collection }: Standing): [string, string] {
  const kind = COLLECTION_LABELS[collection];
  const place = `#${entry.position}`;
  const moved = Math.abs(entry.delta ?? 0);
  if (entry.movement === "up") {
    return [` climbed ${moved} to ${place}`, ` in ${kind}`];
  }
  if (entry.movement === "down") {
    return [` fell ${moved} to ${place}`, ` in ${kind}`];
  }
  if (entry.movement === "new") return [` entered ${kind} at ${place}`, ""];
  if (entry.movement === "same") {
    return [` holds ${place}`, ` in ${kind}, unchanged`];
  }
  return [` is ${place}`, ` in ${kind}`];
}

function standingParts(standing: Standing): LedePart[] {
  const [stand, where] = standingText(standing);
  return [
    { text: standing.entry.title, strong: true, app: true },
    { text: stand, strong: true },
    ...(where ? [{ text: where }] : []),
  ];
}

const SCOPES = ["", "", "Across two charts ", "Across the three charts "];

const sinceText = (date: string) => ` since ${formatDayMonth(date)}`;

function countParts(counts: MovementCounts): LedePart[] {
  const moves = [
    [counts.climbed, "climbed"],
    [counts.fell, "fell"],
    [counts.entered, "entered"],
  ] as const;
  const phrases = moves
    .filter(([count]) => count > 0)
    .map(([count, verb], index) =>
      index === 0
        ? `${count} ${count === 1 ? "app" : "apps"} ${verb}`
        : `${count} ${verb}`,
    );
  return phrases.flatMap((text, index) => {
    const part = { text, strong: true };
    if (index === 0) return [part];
    return [{ text: index === phrases.length - 1 ? " and " : ", " }, part];
  });
}

function uncapturedLede(pages: readonly SummaryPage[], day: string | null) {
  const [{ chart, dates }] = pages;
  const category = `${chart.genreName} in ${formatCountry(chart.country)}`;
  return [
    {
      text:
        dates.length === 0 || !day
          ? `${category} has not been captured yet.`
          : `${category} has no capture on ${formatDate(day)}.`,
    },
  ];
}

export function chartLede(
  pages: readonly SummaryPage[],
  day: string | null,
): LedePart[] {
  const captured = pages.filter((page) => page.capture);
  if (captured.length === 0) return uncapturedLede(pages, day);
  const standing = ownStanding(captured);
  const compared = captured.filter((page) => page.comparison);
  const dated = standing?.since && standing.entry.movement !== "none";
  const lead: LedePart[] = standing
    ? [
        ...standingParts(standing),
        {
          text: dated && standing.since ? `${sinceText(standing.since)}.` : ".",
        },
      ]
    : [
        {
          text: `None of your apps is in ${pages.length > 1 ? "these charts" : "this chart"}.`,
        },
      ];
  const since = compared[0]?.comparison;
  if (!since) return lead;
  const moved = countParts(
    movementCounts(compared.flatMap((page) => page.entries)),
  );
  if (moved.length === 0) {
    return [...lead, { text: ` Nothing moved${sinceText(since.date)}.` }];
  }
  return [
    ...lead,
    { text: ` ${SCOPES[compared.length] ?? ""}` },
    ...moved,
    { text: dated ? "." : `${sinceText(since.date)}.` },
  ];
}

export interface TrackedPlace {
  collection: CategoryCollection;
  entry: ChartEntryItem | null;
  depth: number | null;
}

export interface TrackedRow {
  storeAppId: string;
  title: string;
  iconUrl: string | null;
  link: ChartAppLink;
  places: TrackedPlace[];
}

function bestPosition(row: TrackedRow): number {
  return Math.min(
    ...row.places.map((place) => place.entry?.position ?? Infinity),
  );
}

export function trackedRows(pages: readonly SummaryPage[]): TrackedRow[] {
  const rows: TrackedRow[] = [];
  for (const [storeAppId, link] of linksOf(pages)) {
    const places = pages.map((page) => ({
      collection: page.chart.collection,
      entry:
        page.entries.find((entry) => entry.storeAppId === storeAppId) ?? null,
      depth: page.capture?.depth ?? null,
    }));
    const listed = places.find((place) => place.entry)?.entry;
    if (listed) {
      rows.push({
        storeAppId,
        title: listed.title,
        iconUrl: listed.iconUrl,
        link,
        places,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      Number(b.link.role === "own") - Number(a.link.role === "own") ||
      bestPosition(a) - bestPosition(b),
  );
}

export const HISTORY_DAYS = 7;
export const HISTORY_APPS = 10;
export const HISTORY_MIN_DAYS = 4;

export function historyReady(dates: readonly string[], shown: string): boolean {
  return historyDates(dates, shown).length >= HISTORY_MIN_DAYS;
}

export function historyDates(
  dates: readonly string[],
  shown: string,
): string[] {
  return [...new Set([...dates, shown])]
    .filter((date) => date <= shown)
    .sort()
    .slice(-HISTORY_DAYS);
}

export interface HistorySeries {
  id: string;
  title: string;
  own: boolean;
}

export interface ChartHistory {
  series: HistorySeries[];
  rows: Array<{ date: string } & Record<string, number | string | null>>;
}

export function chartHistory(
  days: readonly Pick<ChartPage, "capture" | "entries">[],
  shown: Pick<ChartPage, "entries" | "apps">,
): ChartHistory {
  const own = new Set(
    shown.apps
      .filter((link) => link.role === "own")
      .map((link) => link.storeAppId),
  );
  const series = [...shown.entries]
    .sort((a, b) => a.position - b.position)
    .slice(0, HISTORY_APPS)
    .map((entry) => ({
      id: entry.storeAppId,
      title: entry.title,
      own: own.has(entry.storeAppId),
    }));
  const rows = days.flatMap((day) => {
    if (!day.capture) return [];
    const positions = new Map(
      day.entries.map((entry) => [entry.storeAppId, entry.position]),
    );
    return [
      {
        date: day.capture.date,
        ...Object.fromEntries(
          series.map(({ id }) => [id, positions.get(id) ?? null]),
        ),
      },
    ];
  });
  return { series, rows };
}

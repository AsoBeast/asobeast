import type {
  CategoryCollection,
  ChartAppLink,
  ChartEntryItem,
  ChartPage,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enTopCharts from "../../../messages/en/topCharts.json";
import type { MessageTranslator } from "@/i18n/translator";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatDayMonthInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { collectionLabel } from "./chart-params";
import { genreNameInLocale } from "./genre-name";

const english = createTranslator({
  locale: "en",
  namespace: "topCharts",
  messages: { topCharts: enTopCharts },
});

interface Copy {
  t: MessageTranslator;
  locale: Locale;
}

const DEFAULT_COPY: Copy = { t: english, locale: "en" };

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

export function movementText(
  counts: MovementCounts,
  t: MessageTranslator = english,
): string {
  return t("lede.movement", {
    climbed: counts.climbed,
    entered: counts.entered,
    held: counts.held,
    fell: counts.fell,
  });
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

function standingText(
  { entry, collection }: Standing,
  t: MessageTranslator,
): [string, string] {
  const kind = collectionLabel(collection, t);
  const place = `#${entry.position}`;
  const moved = Math.abs(entry.delta ?? 0);
  if (entry.movement === "up") {
    return [
      t("lede.up", { count: moved, place }),
      t("lede.where", { collection: kind }),
    ];
  }
  if (entry.movement === "down") {
    return [
      t("lede.down", { count: moved, place }),
      t("lede.where", { collection: kind }),
    ];
  }
  if (entry.movement === "new")
    return [t("lede.new", { collection: kind, place }), ""];
  if (entry.movement === "same") {
    return [
      t("lede.same", { place }),
      t("lede.sameWhere", { collection: kind }),
    ];
  }
  return [t("lede.none", { place }), t("lede.where", { collection: kind })];
}

function standingParts(standing: Standing, t: MessageTranslator): LedePart[] {
  const [stand, where] = standingText(standing, t);
  return [
    { text: standing.entry.title, strong: true, app: true },
    { text: stand, strong: true },
    ...(where ? [{ text: where }] : []),
  ];
}

const sinceText = (date: string, t: MessageTranslator, locale: Locale) =>
  t("lede.since", { date: formatDayMonthInLocale(date, locale) });

function countParts(counts: MovementCounts, copy: Copy): LedePart[] {
  const { t } = copy;
  const moves = [
    [counts.climbed, "climbed"],
    [counts.fell, "fell"],
    [counts.entered, "entered"],
  ] as const;
  const phrases = moves
    .filter(([count]) => count > 0)
    .map(([count, verb], index) =>
      index === 0
        ? t("lede.firstCount", { count, verb: t(`lede.verbs.${verb}`) })
        : t("lede.restCount", { count, verb: t(`lede.verbs.${verb}`) }),
    );
  return phrases.flatMap((text, index) => {
    const part = { text, strong: true };
    if (index === 0) return [part];
    return [
      {
        text: index === phrases.length - 1 ? t("lede.and") : t("lede.comma"),
      },
      part,
    ];
  });
}

function uncapturedLede(
  pages: readonly SummaryPage[],
  day: string | null,
  copy: Copy,
) {
  const { t, locale } = copy;
  const [{ chart, dates }] = pages;
  const category = `${genreNameInLocale(chart.genreName, locale)} in ${formatCountryInLocale(chart.country, locale)}`;
  return [
    {
      text:
        dates.length === 0 || !day
          ? t("lede.notCaptured", { category })
          : t("lede.noCaptureOn", {
              category,
              date: formatDateInLocale(day, locale),
            }),
    },
  ];
}

const isDated = (standing: Standing | null): standing is Standing =>
  standing !== null &&
  standing.since !== null &&
  standing.entry.movement !== "none";

function leadParts(
  standing: Standing | null,
  several: boolean,
  copy: Copy,
): LedePart[] {
  const { t, locale } = copy;
  if (!standing) {
    return [
      {
        text: t("lede.noneOwn", {
          charts: t(several ? "lede.theseCharts" : "lede.thisChart"),
        }),
      },
    ];
  }
  const since =
    isDated(standing) && standing.since
      ? sinceText(standing.since, t, locale)
      : "";
  return [...standingParts(standing, t), { text: `${since}.` }];
}

function movedParts(
  compared: readonly SummaryPage[],
  standing: Standing | null,
  copy: Copy,
): LedePart[] {
  const { t, locale } = copy;
  const days = new Set(compared.map((page) => page.comparison?.date));
  const [only] = days;
  const since =
    days.size === 1 && only
      ? sinceText(only, t, locale)
      : t("lede.sinceEarlier");
  const moved = countParts(
    movementCounts(compared.flatMap((page) => page.entries)),
    copy,
  );
  if (moved.length === 0) return [{ text: t("lede.noneMoved", { since }) }];
  const sameDay =
    isDated(standing) && days.size === 1 && only === standing.since;
  return [
    {
      text: t(
        compared.length === 2
          ? "lede.scopeTwo"
          : compared.length === 3
            ? "lede.scopeThree"
            : "lede.scopeOne",
      ),
    },
    ...moved,
    { text: sameDay ? "." : `${since}.` },
  ];
}

export function chartLede(
  pages: readonly SummaryPage[],
  shown: string | null,
  copy: Copy = DEFAULT_COPY,
): LedePart[] {
  const captured = pages.filter((page) => page.capture);
  if (captured.length === 0) return uncapturedLede(pages, shown, copy);
  const standing = ownStanding(captured);
  const compared = captured.filter((page) => page.comparison);
  const lead = leadParts(standing, pages.length > 1, copy);
  return compared.length === 0
    ? lead
    : [...lead, ...movedParts(compared, standing, copy)];
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

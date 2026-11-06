import type { KeywordInspectionSummary, Store } from "@asobeast/shared";
import {
  ZONE_LABELS,
  zoneOf,
  type KeywordZone,
  type ZoneThresholds,
} from "@/lib/keyword-zones";

export const END_ANCHORED_FROM = 72;

export interface LabelScale {
  charWidth: number;
  halfHeight: number;
  offset: number;
  dotRadius: number;
}

export const WIDE_LABEL_SCALE: LabelScale = {
  charWidth: 1.15,
  halfHeight: 2,
  offset: 2,
  dotRadius: 1.4,
};

export const NARROW_LABEL_SCALE: LabelScale = {
  charWidth: 2.9,
  halfHeight: 3,
  offset: 4,
  dotRadius: 3,
};

export interface Storefront {
  store: Store;
  country: string;
}

export interface InspectionPoint {
  id: string;
  keywordId: string;
  keyword: string;
  popularity: number;
  difficulty: number;
  opportunity: number | null;
  zone: KeywordZone;
  completedAt: string | null;
}

export type SuggestionState =
  | { kind: "new" }
  | { kind: "running"; id: string }
  | { kind: "done"; id: string; popularity: number; difficulty: number };

const inStorefront = (
  item: KeywordInspectionSummary,
  storefront: Storefront,
): boolean =>
  item.store === storefront.store && item.country === storefront.country;

export function inspectionPoints(
  items: readonly KeywordInspectionSummary[],
  storefront: Storefront,
  thresholds: ZoneThresholds,
): InspectionPoint[] {
  const seen = new Set<string>();
  const points: InspectionPoint[] = [];
  for (const item of items) {
    if (
      item.status !== "DONE" ||
      !inStorefront(item, storefront) ||
      item.volume === null ||
      item.difficulty100 === null ||
      seen.has(item.keywordId)
    ) {
      continue;
    }
    seen.add(item.keywordId);
    const pair = {
      popularity: Math.round(item.volume),
      difficulty: Math.round(item.difficulty100),
    };
    points.push({
      id: item.id,
      keywordId: item.keywordId,
      keyword: item.keyword,
      ...pair,
      opportunity:
        item.opportunity === null ? null : Math.round(item.opportunity),
      zone: zoneOf(pair, thresholds) ?? "lowPriority",
      completedAt: item.completedAt,
    });
  }
  return points;
}

interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function labelBox(
  point: InspectionPoint,
  scale: LabelScale,
  selected: boolean,
): Box {
  const width =
    point.keyword.length * scale.charWidth * (selected ? 1.2 : 1) +
    (selected ? scale.offset * 2 : 0);
  const offset = selected ? scale.offset * 2.5 : scale.offset;
  const endAnchored = point.difficulty >= END_ANCHORED_FROM;
  const start = endAnchored
    ? point.difficulty - offset - width
    : point.difficulty + offset;
  return {
    left: start,
    right: start + width,
    bottom: point.popularity - scale.halfHeight,
    top: point.popularity + scale.halfHeight,
  };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;

const covers = (box: Box, point: InspectionPoint, radius: number): boolean =>
  overlaps(box, {
    left: point.difficulty - radius,
    right: point.difficulty + radius,
    bottom: point.popularity - radius,
    top: point.popularity + radius,
  });

export function labelledKeywords(
  points: readonly InspectionPoint[],
  selectedKeywordId: string | null,
  scale: LabelScale = WIDE_LABEL_SCALE,
): ReadonlySet<string> {
  const order = [...points].sort(
    (a, b) =>
      Number(b.keywordId === selectedKeywordId) -
        Number(a.keywordId === selectedKeywordId) ||
      (b.opportunity ?? -1) - (a.opportunity ?? -1) ||
      a.keyword.localeCompare(b.keyword),
  );
  const placed: Box[] = [];
  const labelled = new Set<string>();
  for (const point of order) {
    const box = labelBox(point, scale, point.keywordId === selectedKeywordId);
    const blocked =
      placed.some((other) => overlaps(other, box)) ||
      points.some(
        (other) => other !== point && covers(box, other, scale.dotRadius),
      );
    if (point.keywordId === selectedKeywordId || !blocked) {
      placed.push(box);
      labelled.add(point.keywordId);
    }
  }
  return labelled;
}

export function pointName(point: InspectionPoint): string {
  return [
    point.keyword,
    `popularity ${point.popularity}`,
    `difficulty ${point.difficulty}`,
    point.opportunity === null ? null : `opportunity ${point.opportunity}`,
    ZONE_LABELS[point.zone],
  ]
    .filter((part) => part !== null)
    .join(", ");
}

const normalized = (term: string): string => term.trim().toLowerCase();

export function suggestionState(
  term: string,
  items: readonly KeywordInspectionSummary[],
  storefront: Storefront,
): SuggestionState {
  const matches = items.filter(
    (item) =>
      inStorefront(item, storefront) && item.keyword === normalized(term),
  );
  const running = matches.find((item) => item.status === "PENDING");
  if (running) return { kind: "running", id: running.id };
  const done = matches.find(
    (item) =>
      item.status === "DONE" &&
      item.volume !== null &&
      item.difficulty100 !== null,
  );
  if (done?.volume != null && done.difficulty100 != null) {
    return {
      kind: "done",
      id: done.id,
      popularity: Math.round(done.volume),
      difficulty: Math.round(done.difficulty100),
    };
  }
  return { kind: "new" };
}

export function nextHops(keyword: string, terms: readonly string[]): string[] {
  const own = normalized(keyword);
  return terms.filter((term) => normalized(term) !== own);
}

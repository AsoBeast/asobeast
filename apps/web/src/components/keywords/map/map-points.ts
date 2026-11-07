import {
  countChars,
  formatCheckedPosition,
  keywordLabel,
  truncateChars,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import {
  ZONE_LABELS,
  zoneOf,
  type KeywordZone,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import { hasFloorAnswer, scorePair } from "@/lib/keyword-scores";
import { opportunityOrder } from "./dot-navigation";

export const MAP_LABEL_LIMIT = 5;
export const MAP_LABEL_CHARS = 22;
export const OVERLAY_GAP = 8;

export interface MapPoint {
  keywordId: string;
  text: string;
  country: string;
  popularity: number;
  difficulty: number;
  zone: KeywordZone;
  opportunity: number | null;
  position: number | null;
  depth: number | null;
  positionLabel: string | null;
  ranked: boolean;
  floor: boolean;
  active: boolean;
}

export interface MapPoints {
  points: MapPoint[];
  unplotted: number;
}

export interface OverlayPosition {
  left: number;
  top: number;
}

interface Size {
  width: number;
  height: number;
}

export function mapPoints(
  keywords: readonly TrackedKeywordItem[],
  thresholds: ZoneThresholds,
): MapPoints {
  const points: MapPoint[] = [];
  let unplotted = 0;
  for (const keyword of keywords) {
    const pair = scorePair(keyword);
    const zone = zoneOf(pair, thresholds);
    if (pair === null || zone === null) {
      unplotted += 1;
      continue;
    }
    points.push({
      keywordId: keyword.keywordId,
      text: keyword.text,
      country: keyword.country,
      popularity: pair.popularity,
      difficulty: pair.difficulty,
      zone,
      opportunity: keyword.opportunity,
      position: keyword.latestPosition,
      depth: keyword.latestDepth,
      positionLabel: formatCheckedPosition(
        keyword.latestPosition,
        keyword.latestDepth,
      ),
      ranked: keyword.latestPosition !== null,
      floor: hasFloorAnswer(keyword),
      active: keyword.active,
    });
  }
  return { points, unplotted };
}

const plottedCount = (keywords: readonly TrackedKeywordItem[]): number =>
  keywords.filter((keyword) => scorePair(keyword) !== null).length;

export const filtersNarrowMap = (
  shown: readonly TrackedKeywordItem[],
  all: readonly TrackedKeywordItem[],
): boolean => plottedCount(shown) < plottedCount(all);

export function labelledIds(
  points: readonly MapPoint[],
  zone: KeywordZone | null,
): ReadonlySet<string> {
  const eligible = points.filter(
    (point) =>
      point.opportunity !== null && (zone === null || point.zone === zone),
  );
  const spots = new Set<string>();
  const labelled = new Set<string>();
  for (const point of opportunityOrder(eligible)) {
    if (labelled.size === MAP_LABEL_LIMIT) break;
    const spot = `${point.difficulty}:${point.popularity}`;
    if (spots.has(spot)) continue;
    spots.add(spot);
    labelled.add(point.keywordId);
  }
  return labelled;
}

export const dotLabel = (text: string): string =>
  countChars(text) <= MAP_LABEL_CHARS
    ? text
    : `${truncateChars(text, MAP_LABEL_CHARS)}…`;

export function rankWords(
  point: Pick<MapPoint, "positionLabel" | "position" | "depth">,
): string {
  if (point.positionLabel === null) return "not checked yet";
  return point.position === null
    ? `not in the top ${point.depth}`
    : `position ${point.positionLabel}`;
}

export const pointName = (point: MapPoint, multiMarket: boolean): string =>
  multiMarket ? keywordLabel(point) : point.text;

export function dotName(point: MapPoint, multiMarket: boolean): string {
  return [
    pointName(point, multiMarket),
    rankWords(point),
    `popularity ${point.popularity}${point.floor ? ", floor answer" : ""}`,
    `difficulty ${point.difficulty}`,
    point.opportunity === null ? null : `opportunity ${point.opportunity}`,
    ZONE_LABELS[point.zone],
    point.active ? null : "paused",
  ]
    .filter((part) => part !== null)
    .join(", ");
}

const clamp = (value: number, max: number): number =>
  Math.max(0, Math.min(value, max));

export function placeOverlay(
  dot: { x: number; y: number },
  overlay: Size,
  surface: Size,
): OverlayPosition {
  const right = dot.x + OVERLAY_GAP;
  const left =
    right + overlay.width <= surface.width
      ? right
      : dot.x - OVERLAY_GAP - overlay.width;
  const above = dot.y - OVERLAY_GAP - overlay.height;
  const top = above >= 0 ? above : dot.y + OVERLAY_GAP;
  return {
    left: clamp(left, surface.width - overlay.width),
    top: clamp(top, surface.height - overlay.height),
  };
}

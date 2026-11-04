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
import { hasFloorAnswer, scorePair } from "../keyword-scores";
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

export interface OverlayPlacement {
  horizontal: "left" | "right";
  vertical: "above" | "below";
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

export function labelledIds(
  points: readonly MapPoint[],
  zone: KeywordZone | null,
): ReadonlySet<string> {
  const eligible = points.filter(
    (point) =>
      point.opportunity !== null && (zone === null || point.zone === zone),
  );
  return new Set(
    opportunityOrder(eligible)
      .slice(0, MAP_LABEL_LIMIT)
      .map((point) => point.keywordId),
  );
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

export function placeOverlay(
  dot: { x: number; y: number },
  overlay: Size,
  surface: Size,
): OverlayPlacement {
  return {
    horizontal:
      dot.x + OVERLAY_GAP + overlay.width <= surface.width ? "right" : "left",
    vertical: dot.y - OVERLAY_GAP - overlay.height >= 0 ? "above" : "below",
  };
}

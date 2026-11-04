import { ArrowDownToLine } from "lucide-react";
import { ZONE_LABELS } from "@/lib/keyword-zones";
import {
  OVERLAY_GAP,
  placeOverlay,
  pointName,
  rankWords,
  type MapPoint,
} from "./map-points";

export const OVERLAY_SIZE = { width: 224, height: 112 } as const;

export interface ActiveDot {
  point: MapPoint;
  x: number;
  y: number;
  surface: { width: number; height: number };
}

const TRANSFORMS = {
  right: `${OVERLAY_GAP}px`,
  left: `calc(-100% - ${OVERLAY_GAP}px)`,
  above: `calc(-100% - ${OVERLAY_GAP}px)`,
  below: `${OVERLAY_GAP}px`,
} as const;

const capitalized = (text: string): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

function OverlayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric font-mono font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function MapOverlay({
  active,
  multiMarket,
}: {
  active: ActiveDot | null;
  multiMarket: boolean;
}) {
  if (active === null) return null;
  const { point } = active;
  const placement = placeOverlay(active, OVERLAY_SIZE, active.surface);
  return (
    <div
      data-slot="map-overlay"
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 grid w-56 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-overlay"
      style={{
        left: active.x,
        top: active.y,
        transform: `translate(${TRANSFORMS[placement.horizontal]}, ${TRANSFORMS[placement.vertical]})`,
      }}
    >
      <p className="font-medium wrap-anywhere">
        {pointName(point, multiMarket)}
      </p>
      <dl className="grid gap-1">
        <OverlayRow
          label="Position"
          value={
            point.position === null
              ? capitalized(rankWords(point))
              : String(point.position)
          }
        />
        <OverlayRow label="Popularity" value={String(point.popularity)} />
        <OverlayRow label="Difficulty" value={String(point.difficulty)} />
        {point.opportunity === null ? null : (
          <OverlayRow label="Opportunity" value={String(point.opportunity)} />
        )}
      </dl>
      {point.floor ? (
        <p className="flex items-center gap-1 text-muted-foreground">
          <ArrowDownToLine aria-hidden className="size-3" />
          <span>Floor answer</span>
        </p>
      ) : null}
      <p className="flex flex-wrap gap-x-2 text-muted-foreground">
        <span>{ZONE_LABELS[point.zone]}</span>
        {point.active ? null : <span>Paused</span>}
      </p>
    </div>
  );
}

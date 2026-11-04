"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  formatCheckedPosition,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import type { KeywordZone } from "@/lib/keyword-zones";
import { staleCheckDay } from "@/lib/keyword-checks";
import {
  PositionHistoryPopoverContent,
  type PositionHistoryContext,
} from "../PositionHistoryPopover";
import { directionOfKey, edgeDot, entryDot, neighbour } from "./dot-navigation";
import { labelledIds, type MapPoint } from "./map-points";
import {
  dotIn,
  MapDotActionsContext,
  MapDotState,
  type MapDotActions,
} from "./MapDot";
import { MapOverlay } from "./MapOverlay";

const OPEN_KEYS = new Set(["Enter", " "]);
const EDGE_KEYS: Readonly<Record<string, "first" | "last">> = {
  Home: "first",
  End: "last",
};

function nextDotId(
  points: readonly MapPoint[],
  from: string,
  key: string,
): string | null {
  const direction = directionOfKey(key);
  if (direction !== null) return neighbour(points, from, direction);
  return Object.hasOwn(EDGE_KEYS, key) ? edgeDot(points, EDGE_KEYS[key]) : null;
}

const isNavigationKey = (key: string): boolean =>
  directionOfKey(key) !== null || Object.hasOwn(EDGE_KEYS, key);

const keepUnless =
  (keywordId: string) =>
  (current: string | null): string | null =>
    current === keywordId ? null : current;

export function MapSurface({
  points,
  zone,
  keywords,
  history,
  today,
  children,
}: {
  points: readonly MapPoint[];
  zone: KeywordZone | null;
  keywords: ReadonlyMap<string, TrackedKeywordItem>;
  history: PositionHistoryContext;
  today: string;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<Element | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rovingId, setRovingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const returnTo = useRef<string | null>(null);

  const roving =
    rovingId !== null && points.some((point) => point.keywordId === rovingId)
      ? rovingId
      : entryDot(points);

  const actions = useMemo<MapDotActions>(() => {
    const open = (point: MapPoint, element: Element) => {
      if (point.depth === null) return;
      anchorRef.current = element;
      returnTo.current = point.keywordId;
      setHoveredId(null);
      setOpenId(point.keywordId);
    };
    return {
      hover: (point) => setHoveredId(point.keywordId),
      unhover: (point) => setHoveredId(keepUnless(point.keywordId)),
      focus(point) {
        setRovingId(point.keywordId);
        setFocusedId(point.keywordId);
      },
      blur(point, element) {
        if (element.isConnected) setFocusedId(keepUnless(point.keywordId));
      },
      open,
      key(point, event: KeyboardEvent<Element>) {
        if (OPEN_KEYS.has(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          open(point, event.currentTarget);
          return;
        }
        if (event.key === "Escape") {
          setHoveredId(null);
          setFocusedId(null);
          return;
        }
        if (!isNavigationKey(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = nextDotId(points, point.keywordId, event.key);
        if (next !== null) dotIn(surfaceRef.current, next)?.focus();
      },
    };
  }, [points]);

  const labelled = useMemo(() => labelledIds(points, zone), [points, zone]);
  const dotState = useMemo(
    () => ({
      chosenZone: zone,
      labelled,
      rovingId: roving,
      focusedId,
      openId,
      multiMarket: history.multiMarket,
    }),
    [zone, labelled, roving, focusedId, openId, history.multiMarket],
  );
  const openKeyword = openId === null ? undefined : keywords.get(openId);
  const shownId = hoveredId ?? focusedId;
  const shown = points.find((point) => point.keywordId === shownId) ?? null;

  return (
    <div ref={surfaceRef} className="relative">
      <MapDotActionsContext.Provider value={actions}>
        <MapDotState.Provider value={dotState}>{children}</MapDotState.Provider>
      </MapDotActionsContext.Provider>
      <MapOverlay
        point={shown}
        multiMarket={history.multiMarket}
        surfaceRef={surfaceRef}
      />
      <Popover
        open={openKeyword !== undefined}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      >
        <PopoverAnchor virtualRef={anchorRef} />
        {openKeyword === undefined ? null : (
          <PositionHistoryPopoverContent
            {...history}
            keyword={openKeyword}
            label={
              formatCheckedPosition(
                openKeyword.latestPosition,
                openKeyword.latestDepth,
              ) ?? ""
            }
            staleOn={staleCheckDay(openKeyword, today)}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const id = returnTo.current;
              if (id !== null) dotIn(surfaceRef.current, id)?.focus();
            }}
          />
        )}
      </Popover>
    </div>
  );
}

"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownToLine } from "lucide-react";
import { zoneLabel } from "@/lib/keyword-zones";
import { DOT_TARGET, dotIn } from "./MapDot";
import { placeOverlay, pointName, type MapPoint } from "./map-points";

function OverlayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric font-medium text-foreground">{value}</dd>
    </div>
  );
}

function centreIn(element: Element, surface: DOMRect) {
  const box = element.getBoundingClientRect();
  return {
    x: box.left + box.width / 2 - surface.left,
    y: box.top + box.height / 2 - surface.top,
  };
}

export function MapOverlay({
  point,
  multiMarket,
  surfaceRef,
}: {
  point: MapPoint | null;
  multiMarket: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  useLayoutEffect(() => {
    const node = overlayRef.current;
    const surface = surfaceRef.current;
    if (node === null || surface === null || point === null) return;
    const target = dotIn(surface, point.keywordId)?.querySelector(DOT_TARGET);
    if (!target) return;
    const box = surface.getBoundingClientRect();
    const size = node.getBoundingClientRect();
    const position = placeOverlay(
      centreIn(target, box),
      { width: size.width, height: size.height },
      { width: box.width, height: box.height },
    );
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
  }, [point, surfaceRef]);
  if (point === null) return null;
  return (
    <div
      ref={overlayRef}
      data-slot="map-overlay"
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 grid w-56 max-w-full gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-caption shadow-overlay"
    >
      <p className="font-medium wrap-anywhere">
        {pointName(point, multiMarket)}
      </p>
      <dl className="grid gap-1">
        <OverlayRow
          label={t("map.overlay.position")}
          value={
            point.position === null
              ? point.depth === null
                ? t("map.overlay.notChecked")
                : t("map.overlay.notFound", { depth: point.depth })
              : String(point.position)
          }
        />
        <OverlayRow
          label={t("map.overlay.popularity")}
          value={String(point.popularity)}
        />
        <OverlayRow
          label={t("map.overlay.difficulty")}
          value={String(point.difficulty)}
        />
        {point.opportunity === null ? null : (
          <OverlayRow
            label={t("map.overlay.opportunity")}
            value={String(point.opportunity)}
          />
        )}
      </dl>
      {point.floor ? (
        <p className="flex items-center gap-1 text-muted-foreground">
          <ArrowDownToLine aria-hidden className="size-3" />
          <span>{t("map.overlay.floor")}</span>
        </p>
      ) : null}
      <p className="flex flex-wrap gap-x-2 text-muted-foreground">
        <span>{zoneLabel(point.zone, keywords)}</span>
        {point.active ? null : <span>{t("map.overlay.paused")}</span>}
      </p>
    </div>
  );
}

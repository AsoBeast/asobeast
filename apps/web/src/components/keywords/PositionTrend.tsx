"use client";

import { useTranslations } from "next-intl";
import type { KeywordRecentPosition } from "@asobeast/shared";
import {
  positionTrendShape,
  TREND_HEIGHT,
  TREND_WIDTH,
} from "./position-trend";
import type { TrendFrame } from "@/lib/trend-window";

export function PositionTrend({
  checks,
  frame,
  checked,
}: {
  checks: readonly KeywordRecentPosition[] | undefined;
  frame: TrendFrame;
  checked: boolean;
}) {
  const t = useTranslations("keywords");
  const shape = positionTrendShape(checks, frame);
  if (!shape) {
    return checked ? (
      <span
        style={{ width: TREND_WIDTH }}
        className="shrink-0 whitespace-normal text-caption leading-tight text-muted-foreground keywords-tight:hidden"
      >
        {t("position.trendNotEnough")}
      </span>
    ) : (
      <span
        aria-hidden
        style={{ width: TREND_WIDTH }}
        className="keywords-tight:hidden"
      />
    );
  }
  return (
    <svg
      role="img"
      aria-label={t("position.trendLabel", {
        days: frame.days,
        first: shape.first,
        last: shape.last,
      })}
      data-slot="position-trend"
      width={TREND_WIDTH}
      height={TREND_HEIGHT}
      viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
      className="shrink-0 text-muted-foreground keywords-tight:hidden"
    >
      <path
        d={shape.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={shape.end.x}
        cy={shape.end.y}
        r={2.5}
        className="fill-foreground"
      />
    </svg>
  );
}

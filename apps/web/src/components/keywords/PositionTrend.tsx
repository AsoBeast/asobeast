import type { KeywordRecentPosition } from "@asobeast/shared";
import {
  positionTrendShape,
  TREND_HEIGHT,
  TREND_WIDTH,
} from "./position-trend";

import { TREND_WINDOW_DAYS, type TrendWindow } from "@/lib/trend-window";

export function PositionTrend({
  checks,
  trendWindow,
}: {
  checks: readonly KeywordRecentPosition[] | undefined;
  trendWindow: TrendWindow;
}) {
  const days = TREND_WINDOW_DAYS[trendWindow];
  const shape = positionTrendShape(checks, days);
  if (!shape) {
    return checks && checks.length > 0 ? (
      <span
        style={{ width: TREND_WIDTH }}
        className="shrink-0 text-caption leading-tight text-muted-foreground keywords-tight:hidden"
      >
        Not enough checks
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
      aria-label={`Position over the last ${days} days, from ${shape.first} to ${shape.last}`}
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

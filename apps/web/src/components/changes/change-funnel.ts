import type { ChangeImpactFunnel, ChangeImpactReport } from "@asobeast/shared";

const CHIP_WINDOW_DAYS = 7;
const PERCENT = 100;

export function funnelByDay(
  report: ChangeImpactReport,
): Map<string, ChangeImpactFunnel> {
  const byDay = new Map<string, ChangeImpactFunnel>();
  for (const item of report.items) {
    const funnel = item.windows.find(
      (window) => window.days === CHIP_WINDOW_DAYS,
    )?.funnel;
    if (funnel) byDay.set(item.changedOn, funnel);
  }
  return byDay;
}

export function conversionChip(
  funnel: ChangeImpactFunnel | undefined,
): number | null {
  const change =
    funnel?.status === "measured" ? funnel.change?.conversion : null;
  return change === null || change === undefined
    ? null
    : Math.round(change * PERCENT);
}

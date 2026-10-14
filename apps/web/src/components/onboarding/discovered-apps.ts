import type {
  CompetitorDiscovery,
  CompetitorDiscoveryItem,
  CompetitorItem,
} from "@asobeast/shared";
import { DISCOVERY_WINDOWS } from "@/lib/ranges";

export const DISCOVERED_LIMIT = 5;
export const DISCOVERY_WINDOW_DAYS = DISCOVERY_WINDOWS[1];

const competitorTitles = (competitors: readonly CompetitorItem[]) =>
  new Set(
    competitors.flatMap((competitor) =>
      [competitor.name, competitor.latestSnapshot?.title].filter(
        (title): title is string => Boolean(title),
      ),
    ),
  );

export function discoveredRows(
  discovery: CompetitorDiscovery | undefined,
  competitors: readonly CompetitorItem[],
): CompetitorDiscoveryItem[] {
  if (!discovery) return [];
  const tracked = competitorTitles(competitors);
  return discovery.items
    .filter((item) => !tracked.has(item.title))
    .slice(0, DISCOVERED_LIMIT);
}

export function discoveredEmptyText(
  collecting: boolean,
  windowDays: number,
): string {
  return collecting
    ? "Positions are still being collected. Apps that rank for your keywords appear here within minutes."
    : `Nothing ranks beside you in the last ${windowDays} days yet.`;
}

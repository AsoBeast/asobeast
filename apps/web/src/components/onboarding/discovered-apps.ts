import type {
  CompetitorDiscovery,
  CompetitorDiscoveryItem,
} from "@asobeast/shared";
import { DISCOVERY_WINDOWS } from "@/lib/ranges";

export const DISCOVERED_LIMIT = 5;
export const DISCOVERY_WINDOW_DAYS = DISCOVERY_WINDOWS[1];

export function discoveredRows(
  discovery: CompetitorDiscovery | undefined,
): CompetitorDiscoveryItem[] {
  return discovery ? discovery.items.slice(0, DISCOVERED_LIMIT) : [];
}

export function discoveredEmptyText(
  collecting: boolean,
  windowDays: number,
): string {
  return collecting
    ? "Positions are still being collected. Apps that rank for your keywords appear here within minutes."
    : `Nothing ranks beside you in the last ${windowDays} days yet.`;
}

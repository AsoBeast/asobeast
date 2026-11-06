import type { DiscoveryBudget } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

export function discoveryNote(
  discovery: DiscoveryBudget | undefined,
): string | null {
  if (!discovery || discovery.checksPerWeek === 0) return null;
  return `Keyword discovery adds up to ${pluralize(discovery.checksPerWeek, "search", "searches")} a week, about ${pluralize(discovery.requestsPerWeek, "request")}, outside this daily total.`;
}

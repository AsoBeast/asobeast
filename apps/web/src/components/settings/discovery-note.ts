import type { DiscoveryBudget } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export function discoveryNote(
  discovery: DiscoveryBudget | undefined,
  translator: MessageTranslator,
): string | null {
  if (!discovery || discovery.checksPerWeek === 0) return null;
  return translator("capacity.discovery", {
    searches: discovery.checksPerWeek,
    requests: discovery.requestsPerWeek,
  });
}

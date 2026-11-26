import type { AppListItem } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";

export function switcherSubtitle(
  apps: AppListItem[] | undefined,
  failed: boolean,
  context?: TranslationContext,
): string {
  if (apps) {
    return context
      ? context.translator("trackedCount", { count: apps.length })
      : `${apps.length} tracked`;
  }
  if (!context) {
    return failed ? "Could not load apps" : "Loading apps…";
  }
  return context.translator(failed ? "couldNotLoadApps" : "loadingApps");
}

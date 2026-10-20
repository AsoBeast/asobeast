import type { AppListItem } from "@asobeast/shared";

export function switcherSubtitle(
  apps: AppListItem[] | undefined,
  failed: boolean,
): string {
  if (apps) return `${apps.length} tracked`;
  return failed ? "Could not load apps" : "Loading apps…";
}

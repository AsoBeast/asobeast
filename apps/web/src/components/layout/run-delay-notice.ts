import type { WorkspaceRunStatus } from "@asobeast/shared";
import { formatListInLocale, storeLabel } from "@/lib/format";
import type { TranslationContext } from "@/i18n/translator";

export interface RunDelayNotice {
  title: string;
  detail: string;
}

export function runDelayNotice(
  status: WorkspaceRunStatus,
  context?: TranslationContext,
): RunDelayNotice | null {
  if (status.state !== "delayed") {
    return null;
  }

  const behind = status.stores.filter(
    (store) => store.captured < store.tracked,
  );
  const names = behind.map((store) => storeLabel(store.store));
  const all = names.length === 0 || names.length === status.stores.length;
  const scope = all
    ? "Today's rankings"
    : `Rankings for your ${names.join(" and ")} apps`;

  if (context) {
    return {
      title: all
        ? context.translator("delayAllTitle")
        : context.translator("delayStoresTitle", {
            stores: formatListInLocale(names, context.locale),
          }),
      detail:
        status.captured === 0
          ? context.translator("delayEmptyDetail")
          : context.translator("delayProgressDetail", {
              captured: status.captured,
              tracked: status.tracked,
            }),
    };
  }

  return {
    title: `${scope} are delayed`,
    detail:
      status.captured === 0
        ? "Today's run has not captured anything yet. Your stored history is unchanged, and collection resumes on its own."
        : `Today's run has captured ${status.captured} of ${status.tracked} tracked keywords. Positions you see may be from yesterday until it finishes.`,
  };
}

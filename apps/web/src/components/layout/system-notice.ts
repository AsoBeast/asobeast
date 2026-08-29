import type { StoreHealthReport, WorkspaceRunStatus } from "@asobeast/shared";
import { storeLabel } from "@/lib/format";
import { runDelayNotice } from "./run-delay-notice";

export const SCRAPER_BREAKAGE_URL =
  "https://docs.asobeast.com/operations/scraper-breakage";

export type SystemNoticeVariant = "destructive" | "warning";

export interface SystemNotice {
  variant: SystemNoticeVariant;
  title: string;
  detail: string;
  href: string | null;
}

export function systemNotice(input: {
  stores: StoreHealthReport | undefined;
  run: WorkspaceRunStatus | undefined;
}): SystemNotice | null {
  const broken = (input.stores?.stores ?? []).filter(
    (store) => store.state === "broken",
  );
  if (broken.length > 0) {
    return breakageNotice(broken.map((store) => storeLabel(store.store)));
  }

  const delay = input.run ? runDelayNotice(input.run) : null;
  return delay
    ? {
        variant: "warning",
        title: delay.title,
        detail: delay.detail,
        href: null,
      }
    : null;
}

function breakageNotice(names: string[]): SystemNotice {
  const stores = names.join(" and ");
  return {
    variant: "destructive",
    title: `${stores} parsing looks broken`,
    detail: `This is on us, not your setup. Your stored data is untouched and collection resumes on its own once we ship a fix. Until then, collection is paused for ${stores}.`,
    href: SCRAPER_BREAKAGE_URL,
  };
}

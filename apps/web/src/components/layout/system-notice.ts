import type {
  StoreHealthReport,
  WorkspaceDeletionStatus,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { formatDateTime, storeLabel } from "@/lib/format";
import { runDelayNotice } from "./run-delay-notice";

export const WORKSPACE_DELETION_HREF = "/settings#workspace";

export const SCRAPER_BREAKAGE_URL =
  "https://docs.asobeast.com/operations/scraper-breakage";

export type SystemNoticeVariant = "destructive" | "warning";

export interface SystemNotice {
  variant: SystemNoticeVariant;
  title: string;
  detail: string;
  href: string | null;
  linkLabel: string | null;
}

export function systemNotice(input: {
  stores: StoreHealthReport | undefined;
  run: WorkspaceRunStatus | undefined;
  deletion?: WorkspaceDeletionStatus;
}): SystemNotice | null {
  if (input.deletion?.scheduled && input.deletion.dueAt) {
    return deletionNotice(input.deletion.dueAt);
  }

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
        linkLabel: null,
      }
    : null;
}

function deletionNotice(dueAt: string): SystemNotice {
  return {
    variant: "destructive",
    title: "This workspace is scheduled for deletion",
    detail: `Every app, keyword and history in it is erased on or after ${formatDateTime(dueAt)}. The owner can cancel it until then.`,
    href: WORKSPACE_DELETION_HREF,
    linkLabel: "Cancel deletion",
  };
}

function breakageNotice(names: string[]): SystemNotice {
  const stores = names.join(" and ");
  return {
    variant: "destructive",
    title: `${stores} parsing looks broken`,
    detail: `This is on us, not your setup. Your stored data is untouched and collection resumes on its own once we ship a fix. Until then, collection is paused for ${stores}.`,
    href: SCRAPER_BREAKAGE_URL,
    linkLabel: "What happens next",
  };
}

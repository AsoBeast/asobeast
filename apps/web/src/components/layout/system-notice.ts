import type {
  StoreHealthReport,
  WorkspaceDeletionStatus,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import {
  formatDateTime,
  formatDateTimeInLocale,
  formatListInLocale,
  storeLabel,
} from "@/lib/format";
import type { TranslationContext } from "@/i18n/translator";
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

export function systemNotice(
  input: {
    stores: StoreHealthReport | undefined;
    run: WorkspaceRunStatus | undefined;
    deletion?: WorkspaceDeletionStatus;
  },
  context?: TranslationContext,
): SystemNotice | null {
  if (input.deletion?.scheduled && input.deletion.dueAt) {
    return deletionNotice(input.deletion.dueAt, context);
  }

  const broken = (input.stores?.stores ?? []).filter(
    (store) => store.state === "broken",
  );
  if (broken.length > 0) {
    return breakageNotice(
      broken.map((store) => storeLabel(store.store)),
      context,
    );
  }

  const delay = input.run ? runDelayNotice(input.run, context) : null;
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

function deletionNotice(
  dueAt: string,
  context?: TranslationContext,
): SystemNotice {
  if (context) {
    return {
      variant: "destructive",
      title: context.translator("deletionTitle"),
      detail: context.translator("deletionDetail", {
        date: formatDateTimeInLocale(dueAt, context.locale),
      }),
      href: WORKSPACE_DELETION_HREF,
      linkLabel: context.translator("cancelDeletion"),
    };
  }
  return {
    variant: "destructive",
    title: "This workspace is scheduled for deletion",
    detail: `Every app, keyword and history in it is erased on or after ${formatDateTime(dueAt)}. The owner can cancel it until then.`,
    href: WORKSPACE_DELETION_HREF,
    linkLabel: "Cancel deletion",
  };
}

function breakageNotice(
  names: string[],
  context?: TranslationContext,
): SystemNotice {
  if (context) {
    const stores = formatListInLocale(names, context.locale);
    return {
      variant: "destructive",
      title: context.translator("breakageTitle", { stores }),
      detail: context.translator("breakageDetail", { stores }),
      href: SCRAPER_BREAKAGE_URL,
      linkLabel: context.translator("whatHappensNext"),
    };
  }
  const stores = names.join(" and ");
  return {
    variant: "destructive",
    title: `${stores} parsing looks broken`,
    detail: `This is on us, not your setup. Your stored data is untouched and collection resumes on its own once we ship a fix. Until then, collection is paused for ${stores}.`,
    href: SCRAPER_BREAKAGE_URL,
    linkLabel: "What happens next",
  };
}

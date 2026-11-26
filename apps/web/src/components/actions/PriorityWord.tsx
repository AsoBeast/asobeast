"use client";

import type { ActionItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ACTION_PRIORITY_TONE, actionPriorityLabel } from "./action-copy";

export const PRIORITY_COLUMNS = "grid-cols-[4rem_minmax(0,1fr)]";

export function PriorityWord({
  priority,
}: {
  priority: ActionItem["priority"];
}) {
  const t = useTranslations("actions");
  return (
    <span
      className={cn(
        "pt-0.5 text-tick font-semibold tracking-wide uppercase",
        ACTION_PRIORITY_TONE[priority],
      )}
    >
      {actionPriorityLabel(priority, t)}
    </span>
  );
}

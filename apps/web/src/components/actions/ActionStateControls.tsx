"use client";

import { Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ActionItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ActionDismissMenu } from "./ActionDismissMenu";
import { ActionSnoozeMenu } from "./ActionSnoozeMenu";
import { useActionUpdate } from "./use-action-update";

export const isClosed = (item: ActionItem): boolean =>
  item.status === "DONE" ||
  item.status === "DISMISSED" ||
  item.status === "RESOLVED";

export function ActionStateControls({ item }: { item: ActionItem }) {
  const t = useTranslations("actions");
  const { update, isPending } = useActionUpdate(item);

  if (isClosed(item)) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => update({ status: "OPEN" })}
      >
        <RotateCcw aria-hidden className="size-4" />
        {t("reopen")}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => update({ status: "DONE" })}
      >
        <Check aria-hidden className="size-4" />
        {t("done")}
      </Button>
      <ActionSnoozeMenu
        status={item.status}
        snoozedUntil={item.snoozedUntil}
        busy={isPending}
        onSnooze={(snoozedUntil) => update({ status: "SNOOZED", snoozedUntil })}
        onWake={() => update({ status: "OPEN" })}
      />
      <ActionDismissMenu
        busy={isPending}
        onDismiss={(reason) => update({ status: "DISMISSED", reason })}
      />
    </div>
  );
}

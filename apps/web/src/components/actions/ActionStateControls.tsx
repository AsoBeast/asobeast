"use client";

import { Check, RotateCcw } from "lucide-react";
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
  const mutation = useActionUpdate(item);

  if (isClosed(item)) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ status: "OPEN" })}
      >
        <RotateCcw aria-hidden className="size-4" />
        Reopen
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ status: "DONE" })}
      >
        <Check aria-hidden className="size-4" />
        Done
      </Button>
      <ActionSnoozeMenu
        status={item.status}
        snoozedUntil={item.snoozedUntil}
        disabled={mutation.isPending}
        onSnooze={(snoozedUntil) =>
          mutation.mutate({ status: "SNOOZED", snoozedUntil })
        }
        onWake={() => mutation.mutate({ status: "OPEN" })}
      />
      <ActionDismissMenu
        disabled={mutation.isPending}
        onDismiss={(reason) => mutation.mutate({ status: "DISMISSED", reason })}
      />
    </div>
  );
}

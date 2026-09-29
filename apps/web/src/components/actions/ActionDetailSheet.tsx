"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionItem, ActionListResult } from "@asobeast/shared";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { actionDetailOptions, actionKeys } from "@/lib/queries";
import {
  ACTION_NOT_FOUND,
  ActionDetailBody,
  isNotFound,
} from "./ActionDetailBody";
import { ActionDetailHeader } from "./ActionDetailHeader";

function useListedItem(id: string): ActionItem | undefined {
  const queryClient = useQueryClient();
  if (!id) return undefined;
  return queryClient
    .getQueriesData<ActionListResult>({ queryKey: actionKeys.lists })
    .flatMap(([, list]) => list?.items ?? [])
    .find((item) => item.id === id);
}

function PendingHeader({ missing }: { missing: boolean }) {
  return (
    <SheetHeader className="border-b p-4 pr-12">
      <SheetTitle className="text-title">
        {missing ? "Action not found" : "Loading action"}
      </SheetTitle>
      <SheetDescription>
        {missing ? ACTION_NOT_FOUND : "Reading the action and its history."}
      </SheetDescription>
    </SheetHeader>
  );
}

export function ActionDetailSheet({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [shownId, setShownId] = useState(id);
  if (id && id !== shownId) setShownId(id);

  const listed = useListedItem(shownId);
  const detail = useQuery({
    ...actionDetailOptions(shownId),
    enabled: shownId !== "",
  });
  const item = detail.data ?? listed;
  const missing = isNotFound(detail.error);

  return (
    <Sheet open={id !== ""} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target =
            document.getElementById(`action-${shownId}`) ??
            document.querySelector<HTMLElement>(
              'input[aria-label="Search actions"]',
            );
          target?.focus();
        }}
      >
        {item ? (
          <ActionDetailHeader item={item} />
        ) : (
          <PendingHeader missing={missing} />
        )}
        <ActionDetailBody detail={detail} item={item} />
      </SheetContent>
    </Sheet>
  );
}

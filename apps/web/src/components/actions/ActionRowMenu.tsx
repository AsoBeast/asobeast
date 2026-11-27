"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { ActionItem, ActionUpdateRequest } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionDismissSubMenu } from "./ActionDismissMenu";
import { SNOOZE_PRESET_DAYS, snoozeUntil } from "./ActionSnoozeMenu";
import { useRowMenuRequest } from "./row-menu-request";
import { useBusyMenu } from "./use-busy-menu";

export function ActionRowMenu({
  item,
  headline,
  href,
  busy,
  onUpdate,
}: {
  item: ActionItem;
  headline: string;
  href: string;
  busy: boolean;
  onUpdate: (body: ActionUpdateRequest) => void;
}) {
  const t = useTranslations("actions");
  const menu = useBusyMenu(busy);
  const requested = useRowMenuRequest(item.id);
  const dismissTrigger = useRef<HTMLDivElement>(null);
  const onOpenChange = (next: boolean) => {
    if (!next) requested.settle();
    menu.onOpenChange(next);
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${href}`);
    toast.success(t("linkCopied"));
  };

  return (
    <DropdownMenu
      open={menu.open || requested.focus !== null}
      onOpenChange={onOpenChange}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-disabled={busy || undefined}
          aria-label={t("moreActions", { headline })}
          data-command="more"
          className="size-11 @2xl/queue:size-7"
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onFocus={(event) => {
          if (
            requested.focus === null ||
            event.target !== event.currentTarget
          ) {
            return;
          }
          if (requested.focus === "dismiss") {
            event.preventDefault();
            dismissTrigger.current?.focus();
          }
          menu.onOpenChange(true);
          requested.settle();
        }}
      >
        {item.status === "SNOOZED" ? (
          <DropdownMenuItem onSelect={() => onUpdate({ status: "OPEN" })}>
            {t("wakeNow")}
          </DropdownMenuItem>
        ) : (
          SNOOZE_PRESET_DAYS.map((days) => (
            <DropdownMenuItem
              key={days}
              onSelect={() =>
                onUpdate({ status: "SNOOZED", snoozedUntil: snoozeUntil(days) })
              }
            >
              {t("snoozeFor", { count: days })}
            </DropdownMenuItem>
          ))
        )}
        <ActionDismissSubMenu
          triggerRef={dismissTrigger}
          onDismiss={(reason) => onUpdate({ status: "DISMISSED", reason })}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void copyLink()}>
          {t("copyLink")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

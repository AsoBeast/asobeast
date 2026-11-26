"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  ACTION_DISMISS_REASONS,
  type ActionDismissReason,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actionDismissReasonLabel } from "./action-history";
import { useBusyMenu } from "./use-busy-menu";

type OnDismiss = (reason?: ActionDismissReason) => void;

function DismissItems({ onDismiss }: { onDismiss: OnDismiss }) {
  const t = useTranslations("actions");
  return (
    <>
      {ACTION_DISMISS_REASONS.map((reason) => (
        <DropdownMenuItem key={reason} onSelect={() => onDismiss(reason)}>
          {actionDismissReasonLabel(reason, t)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onDismiss()}>
        {t("dismissWithoutReason")}
      </DropdownMenuItem>
    </>
  );
}

export function ActionDismissSubMenu({
  onDismiss,
  triggerRef,
}: {
  onDismiss: OnDismiss;
  triggerRef?: Ref<HTMLDivElement>;
}) {
  const t = useTranslations("actions");
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger ref={triggerRef}>
        {t("dismiss")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DismissItems onDismiss={onDismiss} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function ActionDismissMenu({
  onDismiss,
  busy,
  className,
}: {
  onDismiss: OnDismiss;
  busy: boolean;
  className?: string;
}) {
  const t = useTranslations("actions");
  const menu = useBusyMenu(busy);

  return (
    <DropdownMenu {...menu}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-disabled={busy || undefined}
          data-command="dismiss"
          className={className}
        >
          <X aria-hidden />
          {t("dismiss")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DismissItems onDismiss={onDismiss} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

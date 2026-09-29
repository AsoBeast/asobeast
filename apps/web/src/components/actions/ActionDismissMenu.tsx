"use client";

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
import { ACTION_DISMISS_REASON_LABEL } from "./action-history";

type OnDismiss = (reason?: ActionDismissReason) => void;

function DismissItems({ onDismiss }: { onDismiss: OnDismiss }) {
  return (
    <>
      {ACTION_DISMISS_REASONS.map((reason) => (
        <DropdownMenuItem key={reason} onSelect={() => onDismiss(reason)}>
          {ACTION_DISMISS_REASON_LABEL[reason]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onDismiss()}>
        Dismiss without a reason
      </DropdownMenuItem>
    </>
  );
}

export function ActionDismissSubMenu({ onDismiss }: { onDismiss: OnDismiss }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Dismiss</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DismissItems onDismiss={onDismiss} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function ActionDismissMenu({
  onDismiss,
  disabled,
  className,
}: {
  onDismiss: OnDismiss;
  disabled: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-command="dismiss"
          className={className}
        >
          <X aria-hidden />
          Dismiss
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DismissItems onDismiss={onDismiss} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ReplyConfirmDialog } from "./ReplyConfirmDialog";

export function WithdrawReplyButton({
  busy,
  textRef,
  onWithdraw,
}: {
  busy: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onWithdraw: () => void;
}) {
  return (
    <ReplyConfirmDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          Withdraw from App Store
        </Button>
      }
      title="Withdraw this response?"
      description="Apple removes it within a day. The text stays here."
      cancelLabel="Keep it"
      actionLabel="Withdraw"
      destructive
      textRef={textRef}
      onConfirm={onWithdraw}
    />
  );
}

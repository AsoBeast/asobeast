"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("reviews");
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
          {t("withdraw.button")}
        </Button>
      }
      title={t("withdraw.title")}
      description={t("withdraw.description")}
      cancelLabel={t("withdraw.keepIt")}
      actionLabel={t("withdraw.action")}
      destructive
      textRef={textRef}
      onConfirm={onWithdraw}
    />
  );
}

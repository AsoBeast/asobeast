"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, resendVerification } from "@/lib/api";
import { useSingleFlight } from "@/lib/single-flight";

export function ResendConfirmationButton() {
  const t = useTranslations("auth");
  const resend = useMutation({
    mutationFn: resendVerification,
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("resendConfirmation.failed"),
      );
    },
  });
  const resendOnce = useSingleFlight(resend);
  const locked = resend.isPending || resend.isSuccess;

  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) resendOnce();
      }}
    >
      {resend.isPending ? <Loader2 className="animate-spin" /> : null}
      {resend.isSuccess
        ? t("resendConfirmation.newLinkSent")
        : t("resendConfirmation.send")}
    </Button>
  );
}

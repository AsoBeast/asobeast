"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, resendVerification } from "@/lib/api";
import { useSingleFlight } from "@/lib/single-flight";

export function ResendConfirmationButton() {
  const resend = useMutation({
    mutationFn: resendVerification,
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not send a new link. Try again shortly.",
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
      {resend.isSuccess ? "New link sent" : "Send a new link"}
    </Button>
  );
}

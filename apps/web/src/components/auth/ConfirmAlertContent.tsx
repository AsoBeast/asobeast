"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmEmailAlert } from "@/lib/api";
import {
  AlertLinkCard,
  AlertSettingsLink,
  hasStatus,
  INVALID_LINK_STATUSES,
} from "./AlertLinkCard";

const EXPIRED_STATUS = 410;

export function ConfirmAlertContent() {
  const params = useSearchParams();
  const alertId = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => confirmEmailAlert(alertId, token),
  });

  if (alertId === "" || token === "") {
    return (
      <AlertLinkCard
        title="Confirmation link incomplete"
        description="Open the link from your confirmation email."
      >
        <AlertSettingsLink>Manage alerts in Settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AlertLinkCard
        title="Alert emails confirmed"
        description="This address will now receive the alerts it was added for. Every alert email has an unsubscribe link."
      >
        <AlertSettingsLink>Open settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  if (mutation.isError && hasStatus(mutation.error, INVALID_LINK_STATUSES)) {
    return (
      <AlertLinkCard
        title="This confirmation link is not valid"
        description="The alert may have been deleted, moved to another address or sent a newer link. Ask whoever added this address to resend the confirmation."
      >
        <AlertSettingsLink>Manage alerts in Settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  if (mutation.isError && hasStatus(mutation.error, [EXPIRED_STATUS])) {
    return (
      <AlertLinkCard
        title="This confirmation link has expired"
        description="Ask whoever added this address to resend the confirmation from Settings."
      >
        <AlertSettingsLink>Manage alerts in Settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  return (
    <AlertLinkCard
      title={mutation.isError ? "Could not confirm" : "Confirm alert emails?"}
      description={
        mutation.isError
          ? "Try again in a moment."
          : "AsoBeast will start emailing this address about rank, listing and review changes. Every email has an unsubscribe link."
      }
    >
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
        Confirm email address
      </Button>
    </AlertLinkCard>
  );
}

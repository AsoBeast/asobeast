"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsubscribeEmailAlert } from "@/lib/api";
import {
  AlertLinkCard,
  AlertSettingsLink,
  hasStatus,
  INVALID_LINK_STATUSES,
} from "./AlertLinkCard";

export function UnsubscribeContent() {
  const params = useSearchParams();
  const alertId = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => unsubscribeEmailAlert(alertId, token),
  });

  if (alertId === "" || token === "") {
    return (
      <AlertLinkCard
        title="Unsubscribe link incomplete"
        description="Open the link from your alert email."
      >
        <AlertSettingsLink>Manage alerts in Settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AlertLinkCard
        title="You are unsubscribed"
        description="This address will not receive these alerts any more."
      >
        <AlertSettingsLink>Open settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  if (mutation.isError && hasStatus(mutation.error, INVALID_LINK_STATUSES)) {
    return (
      <AlertLinkCard
        title="This unsubscribe link is not valid"
        description="The alert may have been deleted or moved to another address. Manage alerts in Settings instead."
      >
        <AlertSettingsLink>Manage alerts in Settings</AlertSettingsLink>
      </AlertLinkCard>
    );
  }

  return (
    <AlertLinkCard
      title={mutation.isError ? "Could not unsubscribe" : "Stop email alerts?"}
      description={
        mutation.isError
          ? "Try again in a moment."
          : "This address will stop receiving this AsoBeast email alert. You can turn it back on in Settings at any time."
      }
    >
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
        Unsubscribe
      </Button>
    </AlertLinkCard>
  );
}

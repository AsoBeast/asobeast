"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSingleFlight } from "@/lib/single-flight";
import { unsubscribeEmailAlert } from "@/lib/api";
import {
  AlertLinkCard,
  armResultFocus,
  hasStatus,
  INVALID_LINK_STATUSES,
} from "./AlertLinkCard";

export function UnsubscribeContent() {
  const params = useSearchParams();
  const alertId = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => unsubscribeEmailAlert(alertId, token),
    onSettled: armResultFocus,
  });
  const sendOnce = useSingleFlight(mutation);

  if (alertId === "" || token === "") {
    return (
      <AlertLinkCard
        title="Unsubscribe link incomplete"
        description="Open the link from your alert email."
        settingsLink="Manage alerts in Settings"
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <AlertLinkCard
        title="You are unsubscribed"
        description="This address will not receive these alerts any more."
        settingsLink="Open settings"
      />
    );
  }

  if (mutation.isError && hasStatus(mutation.error, INVALID_LINK_STATUSES)) {
    return (
      <AlertLinkCard
        title="This unsubscribe link is not valid"
        description="The alert may have been deleted or moved to another address."
        settingsLink="Manage alerts in Settings"
      />
    );
  }

  return (
    <AlertLinkCard
      key="ask"
      title={mutation.isError ? "Could not unsubscribe" : "Stop email alerts?"}
      description={
        mutation.isError
          ? "Try again in a moment."
          : "This address will stop receiving this AsoBeast email alert and will not be asked to confirm it again."
      }
    >
      <Button
        aria-disabled={mutation.isPending || undefined}
        onClick={() => {
          if (!mutation.isPending) sendOnce();
        }}
      >
        {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
        Unsubscribe
      </Button>
    </AlertLinkCard>
  );
}

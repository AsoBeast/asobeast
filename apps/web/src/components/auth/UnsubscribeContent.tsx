"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSingleFlight } from "@/lib/single-flight";
import { unsubscribeEmailAlert } from "@/lib/api";
import {
  AlertLinkCard,
  hasStatus,
  INVALID_LINK_STATUSES,
  useResultFocus,
} from "./AlertLinkCard";

export function UnsubscribeContent() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const alertId = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const resultFocus = useResultFocus();
  const mutation = useMutation({
    mutationFn: () => unsubscribeEmailAlert(alertId, token),
    onSettled: resultFocus.hand,
  });
  const sendOnce = useSingleFlight(mutation);

  if (alertId === "" || token === "") {
    return (
      <AlertLinkCard
        title={t("unsubscribe.incompleteTitle")}
        description={t("unsubscribe.incompleteDescription")}
        settingsLink={t("manageAlerts")}
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <AlertLinkCard
        title={t("unsubscribe.successTitle")}
        description={t("unsubscribe.successDescription")}
        settingsLink={t("openSettings")}
      />
    );
  }

  if (mutation.isError && hasStatus(mutation.error, INVALID_LINK_STATUSES)) {
    return (
      <AlertLinkCard
        title={t("unsubscribe.invalidTitle")}
        description={t("unsubscribe.invalidDescription")}
        settingsLink={t("manageAlerts")}
      />
    );
  }

  return (
    <AlertLinkCard
      key="ask"
      title={
        mutation.isError ? t("unsubscribe.failedTitle") : t("unsubscribe.title")
      }
      description={
        mutation.isError ? t("tryAgain") : t("unsubscribe.description")
      }
    >
      <Button
        aria-disabled={mutation.isPending || undefined}
        onClick={() => {
          if (mutation.isPending) return;
          resultFocus.hold();
          sendOnce();
        }}
      >
        {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
        {t("unsubscribe.submit")}
      </Button>
    </AlertLinkCard>
  );
}

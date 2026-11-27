"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSingleFlight } from "@/lib/single-flight";
import { confirmEmailAlert } from "@/lib/api";
import {
  AlertLinkCard,
  hasStatus,
  INVALID_LINK_STATUSES,
  useResultFocus,
} from "./AlertLinkCard";

const EXPIRED_STATUS = 410;

export function ConfirmAlertContent() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const alertId = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const resultFocus = useResultFocus();
  const mutation = useMutation({
    mutationFn: () => confirmEmailAlert(alertId, token),
    onSettled: resultFocus.hand,
  });
  const sendOnce = useSingleFlight(mutation);

  if (alertId === "" || token === "") {
    return (
      <AlertLinkCard
        title={t("alertConfirmation.incompleteTitle")}
        description={t("alertConfirmation.incompleteDescription")}
        settingsLink={t("manageAlerts")}
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <AlertLinkCard
        title={t("alertConfirmation.confirmedTitle")}
        description={t("alertConfirmation.confirmedDescription")}
        settingsLink={t("openSettings")}
      />
    );
  }

  if (mutation.isError && hasStatus(mutation.error, INVALID_LINK_STATUSES)) {
    return (
      <AlertLinkCard
        title={t("alertConfirmation.invalidTitle")}
        description={t("alertConfirmation.invalidDescription")}
        settingsLink={t("manageAlerts")}
      />
    );
  }

  if (mutation.isError && hasStatus(mutation.error, [EXPIRED_STATUS])) {
    return (
      <AlertLinkCard
        title={t("alertConfirmation.expiredTitle")}
        description={t("alertConfirmation.expiredDescription")}
        settingsLink={t("manageAlerts")}
      />
    );
  }

  return (
    <AlertLinkCard
      key="ask"
      title={
        mutation.isError
          ? t("alertConfirmation.failedTitle")
          : t("alertConfirmation.title")
      }
      description={
        mutation.isError ? t("tryAgain") : t("alertConfirmation.description")
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
        {t("alertConfirmation.submit")}
      </Button>
    </AlertLinkCard>
  );
}

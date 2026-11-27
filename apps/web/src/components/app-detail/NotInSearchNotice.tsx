"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function NotInSearchNotice() {
  const t = useTranslations("appDetail");
  return (
    <Alert variant="warning" role="note">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t("notices.notInSearchTitle")}</AlertTitle>
      <AlertDescription>{t("notices.notInSearchBody")}</AlertDescription>
    </Alert>
  );
}

"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";

export const NoSearchTermsContext = createContext<string | null>(null);

export function PlayInstallsTip() {
  const t = useTranslations("keywords");
  const noSearchTermsStatement = useContext(NoSearchTermsContext);
  return (
    <InfoTip
      label={t("playInstalls.about")}
      title={t("playInstalls.title")}
      summary={t("playInstalls.summary")}
    >
      {noSearchTermsStatement ? (
        <p className="text-muted-foreground">{noSearchTermsStatement}</p>
      ) : null}
    </InfoTip>
  );
}

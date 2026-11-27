"use client";

import type { Store } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";

export const STORE_FUNNEL_GUIDE =
  "https://docs.asobeast.com/guides/store-funnel";

export function FunnelHelp({ store }: { store: Store }) {
  const t = useTranslations("overview");
  const prefix = `funnel.help.${store === "APP_STORE" ? "appStore" : "googlePlay"}`;
  return (
    <InfoTip
      label={t("funnel.about")}
      title={t("funnel.title")}
      summary={t(`${prefix}.summary`)}
    >
      <p className="text-muted-foreground">{t(`${prefix}.detail`)}</p>
      <a
        href={STORE_FUNNEL_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("funnel.readNumbers")}
      </a>
    </InfoTip>
  );
}

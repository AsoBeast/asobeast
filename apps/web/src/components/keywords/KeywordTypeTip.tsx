"use client";

import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";

const KEYWORD_TYPES_GUIDE = "https://docs.asobeast.com/concepts/keyword-types";

export function KeywordTypeTip() {
  const t = useTranslations("keywords");
  return (
    <InfoTip
      label={t("typeTip.about")}
      title={t("typeTip.title")}
      summary={t("typeTip.summary")}
    >
      <a
        href={KEYWORD_TYPES_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="link-underline"
      >
        {t("typeTip.read")}
      </a>
    </InfoTip>
  );
}

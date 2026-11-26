"use client";

import type { AppLocalizationOrigin } from "@asobeast/shared";
import { useTranslations } from "next-intl";

export function OriginMark({ origin }: { origin: AppLocalizationOrigin }) {
  const t = useTranslations("localizations");
  return <span>{t(`origin.${origin}`)}</span>;
}

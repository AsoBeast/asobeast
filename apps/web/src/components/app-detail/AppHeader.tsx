"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppDetail } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { appDetailOptions } from "@/lib/queries";
import { formatCountryInLocale, storeLabel } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { AppLink } from "./AppLink";
import { DelistedNotice } from "./DelistedNotice";
import { NotInSearchNotice } from "./NotInSearchNotice";

function storeUrl(detail: AppDetail): string {
  if (detail.store === "GOOGLE_PLAY") {
    return `https://play.google.com/store/apps/details?id=${detail.storeAppId}`;
  }
  return `https://apps.apple.com/${detail.country}/app/id${detail.storeAppId}`;
}

export function AppHeader({ id }: { id: string }) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const t = useTranslations("appDetail");
  const locale = useAppLocale();
  const name = detail.name ?? t("untitled");

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AppIcon src={detail.iconUrl} size={32} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              translate="no"
              title={name}
              className="line-clamp-2 text-title text-balance print:line-clamp-none"
            >
              {name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 text-label text-muted-foreground">
              <span>{storeLabel(detail.store)}</span>
              <span aria-hidden>·</span>
              <span>{`${t("header.homeStorefront", {
                country: formatCountryInLocale(detail.country, locale),
              })}`}</span>
              <span aria-hidden className="print:hidden">
                ·
              </span>
              <a
                href={storeUrl(detail)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-6 items-center gap-1 rounded-sm hover:text-foreground print:hidden"
              >
                <span>{t("header.storePage")}</span>
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </p>
          </div>
        </div>

        <div className="flex print:hidden">
          <AppLink detail={detail} />
        </div>
      </header>
      {detail.delistedAt ? (
        <DelistedNotice detail={detail} since={detail.delistedAt} />
      ) : null}
      {detail.searchable === false ? <NotInSearchNotice /> : null}
    </>
  );
}

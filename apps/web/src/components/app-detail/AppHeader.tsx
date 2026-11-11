"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AppDetail } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { appDetailOptions } from "@/lib/queries";
import { formatCountry, storeLabel } from "@/lib/format";
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
  const name = detail.name ?? "Untitled app";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AppIcon src={detail.iconUrl} size={32} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              title={name}
              className="line-clamp-2 text-title text-balance print:line-clamp-none"
            >
              {name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 text-label text-muted-foreground">
              <span>{storeLabel(detail.store)}</span>
              <span aria-hidden>·</span>
              <span>{`Home storefront ${formatCountry(detail.country)}`}</span>
              <span aria-hidden className="print:hidden">
                ·
              </span>
              <a
                href={storeUrl(detail)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-6 items-center gap-1 rounded-sm hover:text-foreground print:hidden"
              >
                <span>Store page</span>
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

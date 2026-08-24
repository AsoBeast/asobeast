"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AppDetail } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { appDetailOptions } from "@/lib/queries";
import { formatCountry, storeLabel } from "@/lib/format";
import { AppLink } from "./AppLink";

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
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1
          title={name}
          className="line-clamp-2 text-display tracking-tight text-balance"
        >
          {name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
          <Badge variant="secondary">{storeLabel(detail.store)}</Badge>
          <Badge
            variant="outline"
            title={`Home storefront · ${formatCountry(detail.country)}`}
          >
            {detail.country.toUpperCase()}
          </Badge>
          <a
            href={storeUrl(detail)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
          >
            Store page
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <AppLink detail={detail} />
    </header>
  );
}

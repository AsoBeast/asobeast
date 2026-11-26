"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { Skeleton } from "@/components/ui/skeleton";
import { discoveriesHref } from "@/lib/keyword-discoveries";
import { keywordDiscoveriesOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { firstDiscoveries } from "./first-discoveries";

export function FirstDiscoveries({
  id,
  country,
}: {
  id: string;
  country: string;
}) {
  const t = useTranslations("setup");
  const headingId = useId();
  const read = useQuery({
    ...keywordDiscoveriesOptions(id, country),
    refetchOnMount: "always",
  });

  if (failedRead(read)) {
    return (
      <InlineQueryError message={t("firstDiscoveries.loadError")} read={read} />
    );
  }
  if (!read.data) return <Skeleton className="h-16 w-full" />;

  const summary = firstDiscoveries(read.data, t);
  if (summary === null) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-dense font-medium">
        {summary.status === "ready"
          ? t("firstDiscoveries.readyTitle")
          : t("firstDiscoveries.collectingTitle")}
      </h4>
      {summary.status === "ready" ? (
        <>
          <p className="text-dense">{summary.headline}</p>
          <ul aria-labelledby={headingId} className="flex flex-col gap-1">
            {summary.rows.map((row) => (
              <li
                key={row.keywordId}
                className="numeric text-dense text-muted-foreground wrap-anywhere"
              >
                {`“${row.text}” · ${row.rank}`}
              </li>
            ))}
          </ul>
          <Link
            href={discoveriesHref(id, country)}
            className={cn(FOOTER_LINK, "w-fit text-dense")}
          >
            {t("firstDiscoveries.seeAll")}
          </Link>
        </>
      ) : (
        <p className="text-dense text-muted-foreground">
          {t("firstDiscoveries.collectingBody")}
        </p>
      )}
    </section>
  );
}

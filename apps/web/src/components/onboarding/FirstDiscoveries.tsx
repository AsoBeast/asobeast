"use client";

import { useId } from "react";
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
  const headingId = useId();
  const read = useQuery({
    ...keywordDiscoveriesOptions(id, country),
    refetchOnMount: "always",
  });

  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="Could not load the first results."
        read={read}
      />
    );
  }
  if (!read.data) return <Skeleton className="h-16 w-full" />;

  const summary = firstDiscoveries(read.data);
  if (summary === null) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-dense font-medium">
        {summary.status === "ready"
          ? "Your first results are ready"
          : "Looking for keywords near your listing"}
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
            See all discoveries
          </Link>
        </>
      ) : (
        <p className="text-dense text-muted-foreground">
          AsoBeast is checking where your app ranks for the phrases of your
          listing. The first results appear here within minutes.
        </p>
      )}
    </section>
  );
}

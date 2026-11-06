"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { discoveriesHref } from "@/lib/keyword-discoveries";
import { keywordDiscoveriesOptions } from "@/lib/queries";
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
      <h4 id={headingId} className="text-sm font-medium">
        {summary.status === "ready"
          ? "Your first results are ready"
          : "Looking for keywords near your listing"}
      </h4>
      {summary.status === "ready" ? (
        <>
          <p className="text-sm">{summary.headline}</p>
          <ul aria-labelledby={headingId} className="flex flex-col gap-1">
            {summary.rows.map((row) => (
              <li
                key={row.keywordId}
                className="text-sm text-muted-foreground wrap-anywhere"
              >
                {`“${row.text}” · ${row.rank}`}
              </li>
            ))}
          </ul>
          <Button asChild variant="link" className="h-auto w-fit px-0">
            <Link href={discoveriesHref(id, country)}>See all discoveries</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          AsoBeast is checking where your app ranks for the phrases of your
          listing. The first results appear here within minutes.
        </p>
      )}
    </section>
  );
}

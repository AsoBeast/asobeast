"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { LIST_HEAD, LIST_ROW } from "@/components/layout/panel-classes";
import { MOVER_COLUMNS } from "@/components/rankings/MoverList";
import { Skeleton } from "@/components/ui/skeleton";
import { nearTopTen } from "@/lib/near-top-ten";
import { keywordsOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SHOWN = 5;

const HEADING_ID = "near-top-ten-heading";

function NearTopTenRows({ id }: { id: string }) {
  const { country, switchable } = useKeywordScope(id);
  const read = useQuery({
    ...keywordsOptions(id, country),
    refetchInterval: false,
  });

  if (failedRead(read)) {
    return (
      <div className="px-2">
        <InlineQueryError
          message="The keywords near the top 10 could not be loaded."
          read={read}
        />
      </div>
    );
  }
  if (read.data === undefined) {
    return <Skeleton aria-hidden className="mx-2 h-9" />;
  }

  const near = nearTopTen(read.data, SHOWN);
  if (near.length === 0) {
    return (
      <p className="px-2 text-body text-muted-foreground">
        No keyword sits just outside the top 10.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className={cn(MOVER_COLUMNS, LIST_HEAD)}>
        <span>Keyword</span>
        <span className="text-right">Position</span>
        <span className="text-right">To top 10</span>
      </div>
      <ul aria-labelledby={HEADING_ID} className="flex flex-col">
        {near.map((keyword) => (
          <li key={keyword.keywordId}>
            <Link
              href={`/apps/${id}/rankings?keywords=${keyword.keywordId}`}
              className={cn(MOVER_COLUMNS, LIST_ROW)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  translate="no"
                  className="truncate font-medium print:whitespace-normal"
                >
                  {keyword.text}
                </span>
                {switchable && country === undefined ? (
                  <span className="shrink-0 text-label text-muted-foreground">
                    {keyword.country.toUpperCase()}
                  </span>
                ) : null}
              </span>
              <span className="numeric text-right font-medium">
                {String(keyword.position)}
              </span>
              <span className="numeric text-right whitespace-nowrap text-muted-foreground">
                {`${keyword.away} ${keyword.away === 1 ? "place" : "places"}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NearTopTen({ id }: { id: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 id={HEADING_ID} className="px-2 text-label text-muted-foreground">
        Closest to the top 10
      </h3>
      <NearTopTenRows id={id} />
    </section>
  );
}

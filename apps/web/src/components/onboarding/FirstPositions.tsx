"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { keywordsOptions } from "@/lib/queries";
import { firstPositions, positionLabel } from "./first-positions";

function FirstPositionsBody({
  id,
  country,
  headingId,
}: {
  id: string;
  country: string;
  headingId: string;
}) {
  const t = useTranslations("setup");
  const keywords = useQuery({
    ...keywordsOptions(id, country),
    refetchOnMount: "always",
  });

  if (failedRead(keywords)) {
    return (
      <InlineQueryError
        message={t("firstPositions.loadError")}
        read={keywords}
      />
    );
  }
  if (!keywords.data) return <Skeleton className="h-16 w-full" />;

  const summary = firstPositions(keywords.data, t);
  return (
    <>
      <p className="text-dense font-medium">{summary.headline}</p>
      {summary.rows.length > 0 ? (
        <>
          <ul aria-labelledby={headingId} className="flex flex-col gap-1">
            {summary.rows.map((row) => (
              <li
                key={row.keywordId}
                className="numeric text-dense text-muted-foreground"
              >
                {`“${row.text}” · ${positionLabel(row, t)}`}
              </li>
            ))}
          </ul>
          <Button asChild variant="link" className="h-auto w-fit px-0">
            <Link href={`/apps/${id}/rankings`}>
              {t("firstPositions.seeAll")}
            </Link>
          </Button>
        </>
      ) : null}
    </>
  );
}

export function FirstPositions({
  id,
  country,
}: {
  id: string;
  country: string;
}) {
  const t = useTranslations("setup");
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-dense font-medium">
        {t("firstPositions.title")}
      </h3>
      <FirstPositionsBody id={id} country={country} headingId={headingId} />
    </section>
  );
}

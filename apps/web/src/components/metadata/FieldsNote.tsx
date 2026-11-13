"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarket } from "@/components/app-detail/use-market";
import { LOCALIZATIONS_SECTION_ID } from "@/lib/app-localizations";
import { formatDate } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions } from "@/lib/queries";

export function FieldsNote({
  id,
  keywordFields,
}: {
  id: string;
  keywordFields: boolean;
}) {
  const { market, home } = useMarket(id);
  const { data } = useQuery({
    ...appListingOptions(id, queryMarket(market, home)),
    retry: false,
  });
  const capturedAt = data?.latestSnapshot?.capturedAt ?? null;

  return (
    <p className="text-caption text-faint-foreground">
      {capturedAt ? (
        <span>{`Snapshot of ${formatDate(capturedAt)} · `}</span>
      ) : null}
      <span>A scratch pad: nothing typed here is saved.</span>
      {keywordFields ? (
        <>
          <span> The keyword field is saved under </span>
          <a
            href={`#${LOCALIZATIONS_SECTION_ID}`}
            className="text-foreground link-underline"
          >
            App Store localizations
          </a>
          <span>.</span>
        </>
      ) : null}
    </p>
  );
}

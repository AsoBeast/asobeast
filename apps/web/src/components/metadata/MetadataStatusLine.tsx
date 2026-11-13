"use client";

import type { ReactNode } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useLocalization } from "@/components/app-detail/use-localization";
import { useMarket } from "@/components/app-detail/use-market";
import { formatNumber, pluralize } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appLocalizationsOptions, metadataAuditOptions } from "@/lib/queries";
import { metadataStatus, type MetadataStatus } from "./metadata-status";
import { useShowUncovered } from "./use-show-uncovered";

const FIGURE = "font-medium text-foreground";

function Part({ figure, rest }: { figure: string; rest: string }) {
  return (
    <>
      <span className={FIGURE}>{figure}</span>
      <span>{rest}</span>
    </>
  );
}

function CoveragePart({ status }: { status: MetadataStatus }) {
  const showUncovered = useShowUncovered();
  if (status.keywords === 0) return <span>No keywords tracked yet</span>;
  if (status.uncovered === 0) {
    return (
      <>
        {status.keywords > 1 ? <span>All </span> : null}
        <Part figure={pluralize(status.keywords, "keyword")} rest=" covered" />
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={showUncovered}
      className="rounded-sm text-left link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Part
        figure={pluralize(status.uncovered, "keyword")}
        rest=" not covered"
      />
    </button>
  );
}

function statusParts(status: MetadataStatus): ReactNode[] {
  const { fieldsWithIssues, captions, keywordFieldSpace } = status;
  return [
    fieldsWithIssues > 0 ? (
      <Part
        key="issues"
        figure={pluralize(fieldsWithIssues, "field")}
        rest=" with issues"
      />
    ) : null,
    <CoveragePart key="coverage" status={status} />,
    captions ? (
      <Part
        key="captions"
        figure={`${formatNumber(captions.read)} of ${formatNumber(captions.total)}`}
        rest=" captions read"
      />
    ) : null,
    keywordFieldSpace ? (
      <Part
        key="space"
        figure={`${formatNumber(keywordFieldSpace.used)} of ${formatNumber(keywordFieldSpace.limit)}`}
        rest=" keyword field characters used"
      />
    ) : null,
  ].filter((part) => part !== null);
}

export function MetadataStatusLine({
  id,
  keywordFields,
}: {
  id: string;
  keywordFields: boolean;
}) {
  const { market, home } = useMarket(id);
  const localization = useLocalization(id).localization ?? undefined;
  const { data: result } = useSuspenseQuery(
    metadataAuditOptions(id, queryMarket(market, home), localization),
  );
  const localizations = useQuery({
    ...appLocalizationsOptions(id),
    enabled: keywordFields,
    retry: false,
  });
  const parts = statusParts(
    metadataStatus(result, localizations.data?.localizations ?? null),
  );

  return (
    <ul
      aria-label="Work left on this listing"
      className="flex min-w-0 list-none flex-wrap items-center gap-x-2 p-0 text-body text-muted-foreground"
    >
      {parts.map((part, index) => (
        <li key={index} className="flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>{part}</span>
        </li>
      ))}
    </ul>
  );
}

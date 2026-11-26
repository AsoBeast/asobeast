"use client";

import type { ReactNode } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useLocalization } from "@/components/app-detail/use-localization";
import { useMarket } from "@/components/app-detail/use-market";
import type { MessageTranslator } from "@/i18n/translator";
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
  const t = useTranslations("metadata");
  const showUncovered = useShowUncovered();
  if (status.keywords === 0) return <span>{t("status.noKeywords")}</span>;
  if (status.uncovered === 0) {
    return (
      <>
        {status.keywords > 1 ? <span>{t("status.all")}</span> : null}
        <Part
          figure={t("status.keywordCount", { count: status.keywords })}
          rest={t("status.covered")}
        />
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
        figure={t("status.keywordCount", { count: status.uncovered })}
        rest={t("status.notCovered")}
      />
    </button>
  );
}

interface StatusPart {
  key: string;
  node: ReactNode;
}

function statusParts(
  status: MetadataStatus,
  t: MessageTranslator,
): StatusPart[] {
  const { fieldsWithIssues, captions, keywordFieldSpace } = status;
  const parts: (StatusPart | null)[] = [
    fieldsWithIssues > 0
      ? {
          key: "issues",
          node: (
            <Part
              figure={t("status.fieldCount", { count: fieldsWithIssues })}
              rest={t("status.withIssues")}
            />
          ),
        }
      : null,
    { key: "coverage", node: <CoveragePart status={status} /> },
    captions
      ? {
          key: "captions",
          node: (
            <Part
              figure={t("status.captionCount", {
                captioned: captions.captioned,
                total: captions.total,
              })}
              rest={t("status.screenshotsCaption")}
            />
          ),
        }
      : null,
    keywordFieldSpace
      ? {
          key: "space",
          node: (
            <Part
              figure={t("status.spaceCount", {
                used: keywordFieldSpace.used,
                limit: keywordFieldSpace.limit,
              })}
              rest={t("status.keywordFieldUsed")}
            />
          ),
        }
      : null,
  ];
  return parts.filter((part) => part !== null);
}

export function MetadataStatusLine({
  id,
  keywordFields,
}: {
  id: string;
  keywordFields: boolean;
}) {
  const t = useTranslations("metadata");
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
    t,
  );

  return (
    <ul
      aria-label={t("status.aria")}
      className="flex min-w-0 list-none flex-wrap items-center gap-x-2 p-0 text-body text-muted-foreground"
    >
      {parts.map((part, index) => (
        <li key={part.key} className="flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>{part.node}</span>
        </li>
      ))}
    </ul>
  );
}

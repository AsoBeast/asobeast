"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { onlyGapsParser } from "@/lib/search-params";
import { ComparisonTable } from "./ComparisonTable";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { KeywordBreakdownSheet } from "./KeywordBreakdownSheet";
import { SECTION_EMPTY } from "./section-layout";
import { ComparisonBodySkeleton } from "./skeletons";

const EMPTY_LINK = "text-dense font-medium link-underline";

function ComparisonBody({ id, onlyGaps }: { id: string; onlyGaps: boolean }) {
  const t = useTranslations("competitors");
  const { data } = useSuspenseQuery(comparisonOptions(id, onlyGaps));
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  if (data.competitors.length === 0) {
    return (
      <EmptyState
        className={SECTION_EMPTY}
        title={t("comparison.addTitle")}
        body={t("comparison.addBody")}
        action={
          <a href="#competitor-search" className={EMPTY_LINK}>
            {t("comparison.addCta")}
          </a>
        }
      />
    );
  }
  if (data.rows.length === 0) {
    return onlyGaps ? (
      <EmptyState
        className={SECTION_EMPTY}
        title={t("comparison.noGaps")}
        body={t("comparison.noGapsBody")}
      />
    ) : (
      <EmptyState
        className={SECTION_EMPTY}
        title={t("comparison.noData")}
        body={t("comparison.noDataBody")}
        action={
          <Link href={`/apps/${id}/keywords`} className={EMPTY_LINK}>
            {t("comparison.goKeywords")}
          </Link>
        }
      />
    );
  }
  return (
    <ComparisonTable
      data={data}
      competitors={competitors}
      appId={id}
      onlyGaps={onlyGaps}
    />
  );
}

export function ComparisonMatrix({ id }: { id: string }) {
  const t = useTranslations("competitors");
  const [onlyGaps, setOnlyGaps] = useQueryState("onlyGaps", onlyGapsParser);
  return (
    <>
      <CollapsibleCard
        section={COMPETITOR_SECTION.matrix}
        title={t("comparison.title")}
        actions={
          <div className="flex items-center gap-2">
            <Switch
              id="only-gaps"
              checked={onlyGaps}
              onCheckedChange={(next) => setOnlyGaps(next ? true : null)}
            />
            <Label htmlFor="only-gaps" className="text-dense font-normal">
              {t("comparison.onlyGaps")}
            </Label>
          </div>
        }
      >
        <Suspense fallback={<ComparisonBodySkeleton />}>
          <ComparisonBody id={id} onlyGaps={onlyGaps} />
        </Suspense>
      </CollapsibleCard>
      <KeywordBreakdownSheet appId={id} />
    </>
  );
}

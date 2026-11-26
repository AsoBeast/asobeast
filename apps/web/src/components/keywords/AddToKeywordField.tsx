"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { TextCursorInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasMarketReads } from "@/lib/app-localizations";
import {
  keywordFieldAddition,
  keywordFieldAdditionHref,
  keywordFieldTarget,
} from "@/lib/keyword-field-addition";
import { marketKeywordFieldsOptions } from "@/lib/queries";
import type { KeywordTableFeatures } from "./keyword-table-features";

export function AddToKeywordField({
  appId,
  market,
  keywords,
}: {
  appId: string;
  market: string;
  keywords: readonly string[];
}) {
  const t = useTranslations("keywords");
  const { data } = useSuspenseQuery(marketKeywordFieldsOptions(appId, market));
  const target = keywordFieldTarget(data.localizations);
  if (!target) return null;
  const addition = keywordFieldAddition(target.stored, keywords);

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={keywordFieldAdditionHref(appId, target.localization, addition)}
      >
        <TextCursorInput aria-hidden />
        {t("field.add")}
      </Link>
    </Button>
  );
}

export function keywordFieldAction({
  appId,
  market,
  homeCountry,
  keywordFields,
  table,
}: {
  appId: string;
  market: string;
  homeCountry: string;
  keywordFields: boolean;
  table: Table<KeywordTableFeatures, TrackedKeywordItem>;
}): ReactNode {
  if (!keywordFields || !hasMarketReads(homeCountry, market)) return null;
  const keywords = table
    .getSortedRowModel()
    .rows.filter((row) => row.getIsSelected())
    .map((row) => row.original.text);
  return (
    <Suspense fallback={null}>
      <AddToKeywordField appId={appId} market={market} keywords={keywords} />
    </Suspense>
  );
}

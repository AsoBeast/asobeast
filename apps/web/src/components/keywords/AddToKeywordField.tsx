"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { TextCursorInput } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hasMarketReads } from "@/lib/app-localizations";
import {
  additionNotice,
  keywordFieldAddition,
  keywordFieldAdditionHref,
  keywordFieldTarget,
} from "@/lib/keyword-field-addition";
import { localizationName } from "@/lib/localizations";
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
  const { data } = useSuspenseQuery(marketKeywordFieldsOptions(appId, market));
  const target = keywordFieldTarget(data.localizations);
  if (!target) return null;
  const addition = keywordFieldAddition(target.stored, keywords);
  const notice = additionNotice(
    addition,
    localizationName(target.localization),
  );

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={keywordFieldAdditionHref(
          appId,
          target.localization,
          addition.added,
        )}
        onClick={() => {
          if (notice) toast.info(notice);
        }}
      >
        <TextCursorInput aria-hidden />
        Add to keyword field
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

"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import {
  FiltersPopover,
  FiltersSheet,
  type FiltersControlProps,
} from "@/components/data-table/FiltersControl";
import { KeywordFacets } from "./KeywordFacets";

type WidthBoundFilters = ComponentProps<typeof KeywordFacets> &
  Omit<FiltersControlProps, "children">;

export function KeywordFiltersPopover({
  active,
  otherWidth,
  ...facets
}: WidthBoundFilters) {
  return (
    <FiltersPopover active={active} otherWidth={otherWidth}>
      <KeywordFacets {...facets} />
    </FiltersPopover>
  );
}

export function KeywordFiltersSheet({
  active,
  otherWidth,
  ...facets
}: WidthBoundFilters) {
  const t = useTranslations("keywords");
  return (
    <FiltersSheet
      active={active}
      otherWidth={otherWidth}
      description={t("filters.description")}
    >
      <KeywordFacets {...facets} />
    </FiltersSheet>
  );
}

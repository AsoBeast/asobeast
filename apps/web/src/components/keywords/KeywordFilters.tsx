"use client";

import type { ComponentProps } from "react";
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
  return (
    <FiltersSheet
      active={active}
      otherWidth={otherWidth}
      description="Narrow the keywords by source, bucket, status, type, grade and position."
    >
      <KeywordFacets {...facets} />
    </FiltersSheet>
  );
}

"use client";

import type { SetValues } from "nuqs";
import type { Row, Table } from "@tanstack/react-table";
import {
  KEYWORD_BUCKETS,
  KEYWORD_SOURCES,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { BUCKET_LABELS } from "@/components/BucketBadge";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { gradeFill } from "@/components/ui/graded";
import { GRADES, grade, gradeLabel, type GradeMetric } from "@/lib/grade";
import {
  KEYWORD_STATUSES,
  type keywordFilterParsers,
} from "@/lib/search-params";
import {
  countBy,
  POSITION_BAND_LABELS,
  POSITION_BANDS,
  positionBandOf,
} from "@/lib/table/facets";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { STATUS_LABELS, type KeywordFilters } from "./keyword-filters";
import { shownScore } from "./keyword-scores";
import { SOURCE_LABELS } from "./SourceBadge";

type KeywordTable = Table<KeywordTableFeatures, TrackedKeywordItem>;
type KeywordRow = Row<KeywordTableFeatures, TrackedKeywordItem>;

const SOURCE_OPTIONS = KEYWORD_SOURCES.map((value) => ({
  value,
  label: SOURCE_LABELS[value],
}));

const BUCKET_OPTIONS = KEYWORD_BUCKETS.map((value) => ({
  value,
  label: BUCKET_LABELS[value],
}));

const STATUS_OPTIONS = KEYWORD_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const GRADE_OPTIONS = GRADES.map((value) => ({
  value,
  label: gradeLabel(value),
  swatch: gradeFill(value),
}));

const POSITION_OPTIONS = POSITION_BANDS.map((value) => ({
  value,
  label: POSITION_BAND_LABELS[value],
}));

function facetCounts<K>(
  table: KeywordTable,
  id: string,
  key: (row: KeywordRow) => K | null,
): Map<K, number> {
  return countBy(table.getColumn(id)?.getFacetedRowModel().rows ?? [], key);
}

function gradeCounts(table: KeywordTable, id: string, metric: GradeMetric) {
  return facetCounts(table, id, (row) =>
    grade(metric, shownScore(row.getValue<number | undefined>(id) ?? null)),
  );
}

export function KeywordFacets({
  table,
  filters,
  setFilters,
}: {
  table: KeywordTable;
  filters: KeywordFilters;
  setFilters: SetValues<typeof keywordFilterParsers>;
}) {
  return (
    <>
      <FacetFilter
        title="Source"
        options={SOURCE_OPTIONS}
        selected={filters.source}
        counts={facetCounts(table, "source", (row) => row.original.source)}
        onChange={(source) => void setFilters({ source })}
      />
      <FacetFilter
        title="Bucket"
        options={BUCKET_OPTIONS}
        selected={filters.bucket}
        counts={facetCounts(table, "bucket", (row) => row.original.bucket)}
        onChange={(bucket) => void setFilters({ bucket })}
      />
      <SelectFilter
        title="Status"
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(status) => void setFilters({ status })}
      />
      <FacetFilter
        title="Popularity"
        options={GRADE_OPTIONS}
        selected={filters.pop}
        counts={gradeCounts(table, "traffic", "popularity")}
        onChange={(pop) => void setFilters({ pop })}
      />
      <FacetFilter
        title="Difficulty"
        options={GRADE_OPTIONS}
        selected={filters.diff}
        counts={gradeCounts(table, "difficulty", "difficulty")}
        onChange={(diff) => void setFilters({ diff })}
      />
      <FacetFilter
        title="Opportunity"
        options={GRADE_OPTIONS}
        selected={filters.opp}
        counts={gradeCounts(table, "opportunity", "opportunity")}
        onChange={(opp) => void setFilters({ opp })}
      />
      <FacetFilter
        title="Position"
        options={POSITION_OPTIONS}
        selected={filters.pos}
        counts={facetCounts(table, "position", (row) =>
          positionBandOf(row.original.latestPosition, row.original.latestDepth),
        )}
        onChange={(pos) => void setFilters({ pos })}
      />
    </>
  );
}

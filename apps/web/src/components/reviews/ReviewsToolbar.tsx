"use client";

import { Suspense } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { Options } from "nuqs";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { REVIEW_SORTS, type ReviewSort } from "@asobeast/shared";
import { SearchInput } from "@/components/data-table/SearchInput";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REVIEWS_EXPORT_LIMIT,
  reviewsExportOptions,
  reviewsOptions,
} from "@/lib/queries";
import { literalOf } from "@/lib/literal";
import { RATINGS_RANGES, rangeLabel, type RatingsRange } from "@/lib/ranges";
import { hasSearchTerms } from "@/lib/search-text";
import { useAppLocale } from "@/lib/use-app-locale";
import { useSingleFlight } from "@/lib/single-flight";
import { exportReviews, truncatedExportNotice } from "./review-csv";
import { reviewFilters, type ReviewView } from "./review-filters";
import { matchesReviewQuery } from "./review-search";
import { ReplyGuidelinesDialog } from "./ReplyGuidelinesDialog";

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;
const ALL = "all";
const SELECT_WIDTH =
  "w-[150px] max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]";
const STAR_TOGGLE =
  "-ml-px rounded-none first:ml-0 first:rounded-l-md last:rounded-r-md focus-visible:z-10 aria-pressed:bg-accent max-sm:flex-1";

export interface ReviewsToolbarProps {
  id: string;
  view: ReviewView;
  query: string;
  onScore: (score: number | null) => void;
  onVersion: (version: string) => void;
  onSince: (since: RatingsRange | null) => void;
  onSort: (sort: ReviewSort) => void;
  onQuery: (query: string, options: Options) => void;
}

function VersionSelect({
  id,
  version,
  onChange,
}: {
  id: string;
  version: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("reviews");
  const { data } = useSuspenseQuery(reviewsOptions(id, {}));

  return (
    <Select
      value={version || ALL}
      onValueChange={(next) => onChange(next === ALL ? "" : next)}
    >
      <SelectTrigger
        className={SELECT_WIDTH}
        aria-label={t("toolbar.versionFilter")}
      >
        <SelectValue placeholder={t("toolbar.allVersions")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("toolbar.allVersions")}</SelectItem>
        {data.versions.map((item) => (
          <SelectItem key={item} value={item}>
            v{item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SinceSelect({
  since,
  onChange,
}: {
  since: RatingsRange | null;
  onChange: (next: RatingsRange | null) => void;
}) {
  const t = useTranslations("reviews");
  const format = useTranslations("format");
  return (
    <Select
      value={since ?? ALL}
      onValueChange={(next) =>
        onChange(literalOf(RATINGS_RANGES, next) ?? null)
      }
    >
      <SelectTrigger
        className={SELECT_WIDTH}
        aria-label={t("toolbar.dateFilter")}
      >
        <SelectValue placeholder={t("toolbar.anyTime")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("toolbar.anyTime")}</SelectItem>
        {RATINGS_RANGES.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {rangeLabel(preset, format)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExportReviewsButton({
  id,
  view,
  query,
}: {
  id: string;
  view: ReviewView;
  query: string;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const filters = reviewFilters(view);
  const { data } = useQuery(reviewsOptions(id, filters));
  const exporting = useMutation({
    mutationFn: () => queryClient.fetchQuery(reviewsExportOptions(id, filters)),
    onSuccess: (list) => {
      const rows = list.reviews.filter((review) =>
        matchesReviewQuery(review, query),
      );
      if (rows.length === 0) {
        toast.info(t("toolbar.nothingToExport"));
        return;
      }
      exportReviews(id, rows, t);
      const notice = truncatedExportNotice(
        list,
        view.sort,
        hasSearchTerms(query) ? rows.length : null,
        t,
        locale,
      );
      if (notice) toast.info(notice);
    },
    onError: () => {
      toast.error(t("toolbar.exportFailed"));
    },
  });
  const exportOnce = useSingleFlight(exporting);

  return (
    <ExportCsvButton
      subject={t("toolbar.exportSubject")}
      disabled={(data?.total ?? 0) === 0 || exporting.isPending}
      onClick={() => exportOnce()}
      title={t("toolbar.exportTitle", {
        order: t(`toolbar.exportOrder.${view.sort}`),
        limit: REVIEWS_EXPORT_LIMIT,
      })}
    />
  );
}

export function ReviewsToolbar({
  id,
  view,
  query,
  onScore,
  onVersion,
  onSince,
  onSort,
  onQuery,
}: ReviewsToolbarProps) {
  const t = useTranslations("reviews");
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div
        className="flex max-sm:w-full"
        role="group"
        aria-label={t("toolbar.starFilter")}
      >
        {STAR_FILTERS.map((star) => (
          <Button
            key={star}
            variant="outline"
            aria-pressed={view.score === star}
            className={STAR_TOGGLE}
            onClick={() => onScore(view.score === star ? null : star)}
          >
            {star}
            <span aria-hidden>{"★"}</span>
          </Button>
        ))}
      </div>
      <Suspense fallback={null}>
        <VersionSelect id={id} version={view.version} onChange={onVersion} />
      </Suspense>
      <SinceSelect since={view.since} onChange={onSince} />
      <Select
        value={view.sort}
        onValueChange={(next) =>
          onSort(literalOf(REVIEW_SORTS, next) ?? "newest")
        }
      >
        <SelectTrigger
          className={SELECT_WIDTH}
          aria-label={t("toolbar.sortFilter")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REVIEW_SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {t(`toolbar.${sort}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SearchInput
        label={t("toolbar.search")}
        value={query}
        onSearch={onQuery}
      />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ReplyGuidelinesDialog id={id} />
        <ExportReviewsButton id={id} view={view} query={query} />
      </div>
    </div>
  );
}

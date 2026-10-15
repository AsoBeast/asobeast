"use client";

import { Suspense } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { Options } from "nuqs";
import { toast } from "sonner";
import {
  REVIEW_REPLY_STATES,
  REVIEW_SORTS,
  type ReviewReplyState,
  type ReviewSort,
} from "@asobeast/shared";
import { SearchInput } from "@/components/data-table/SearchInput";
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
import { useSingleFlight } from "@/lib/single-flight";
import {
  EXPORT_ORDER,
  exportReviews,
  truncatedExportNotice,
} from "./review-csv";
import { reviewFilters, type ReviewView } from "./review-filters";
import { matchesReviewQuery } from "./review-search";
import { REPLY_STATE_OPTIONS } from "./reply-state";
import { ReplyGuidelinesDialog } from "./ReplyGuidelinesDialog";

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;
const ALL = "all";

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "lowest", label: "Lowest first" },
];

export interface ReviewsToolbarProps {
  id: string;
  view: ReviewView;
  query: string;
  onScore: (score: number | null) => void;
  onVersion: (version: string) => void;
  onReplyState: (state: ReviewReplyState | null) => void;
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
  const { data } = useSuspenseQuery(reviewsOptions(id, {}));

  return (
    <Select
      value={version || ALL}
      onValueChange={(next) => onChange(next === ALL ? "" : next)}
    >
      <SelectTrigger className="w-[140px]" aria-label="Filter by version">
        <SelectValue placeholder="All versions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All versions</SelectItem>
        {data.versions.map((item) => (
          <SelectItem key={item} value={item}>
            v{item}
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
        toast.info("Nothing to export: no review matches this search");
        return;
      }
      exportReviews(id, rows);
      const notice = truncatedExportNotice(list, view.sort);
      if (notice) toast.info(notice);
    },
    onError: () => {
      toast.error("Could not export reviews");
    },
  });
  const exportOnce = useSingleFlight(exporting);

  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-auto"
      disabled={(data?.total ?? 0) === 0 || exporting.isPending}
      onClick={() => exportOnce()}
      aria-label="Export reviews to CSV"
      title={`Exports the ${EXPORT_ORDER[view.sort]} ${REVIEWS_EXPORT_LIMIT} reviews that match the filters`}
    >
      <Download />
      Export CSV
    </Button>
  );
}

export function ReviewsToolbar({
  id,
  view,
  query,
  onScore,
  onVersion,
  onReplyState,
  onSort,
  onQuery,
}: ReviewsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter by star rating"
      >
        {STAR_FILTERS.map((star) => (
          <Button
            key={star}
            size="sm"
            variant={view.score === star ? "default" : "outline"}
            aria-pressed={view.score === star}
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
      <Select
        value={view.replyState ?? ALL}
        onValueChange={(next) =>
          onReplyState(literalOf(REVIEW_REPLY_STATES, next) ?? null)
        }
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by reply state">
          <SelectValue placeholder="Any reply state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any reply state</SelectItem>
          {REPLY_STATE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={view.sort}
        onValueChange={(next) =>
          onSort(literalOf(REVIEW_SORTS, next) ?? "newest")
        }
      >
        <SelectTrigger className="w-[140px]" aria-label="Sort reviews">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SearchInput label="Search reviews" value={query} onSearch={onQuery} />
      <ReplyGuidelinesDialog id={id} />
      <ExportReviewsButton id={id} view={view} query={query} />
    </div>
  );
}

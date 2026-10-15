"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { BellOff, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { storeLabel } from "@/lib/format";
import { accountPlanOptions, chartFollowsOptions } from "@/lib/queries";
import { formatQuotaUsage } from "@/lib/quota-usage";
import { useSingleFlight } from "@/lib/single-flight";
import { followedCategories, type FollowedCategory } from "./chart-follows";
import { categoryTitle, chartHref, COLLECTION_LABELS } from "./chart-params";
import { useUnfollowChart } from "./use-unfollow-chart";

function FollowRow({
  category,
  onNavigate,
}: {
  category: FollowedCategory;
  onNavigate: () => void;
}) {
  const mutation = useUnfollowChart();
  const unfollowOnce = useSingleFlight(mutation);
  const title = categoryTitle(category);
  const kinds = category.follows
    .map((follow) => COLLECTION_LABELS[follow.collection])
    .join(", ");

  return (
    <li className="flex items-center gap-2">
      <Link
        href={chartHref(category)}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 hover:bg-accent"
      >
        <span className="truncate text-sm">{title}</span>
        <span className="text-caption text-muted-foreground">
          {storeLabel(category.store)} · {kinds}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Stop following ${title}`}
        disabled={mutation.isPending}
        onClick={() =>
          unfollowOnce(category.follows.map((follow) => follow.id))
        }
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <BellOff aria-hidden />
        )}
      </Button>
    </li>
  );
}

function FollowList({ onNavigate }: { onNavigate: () => void }) {
  const { data: follows } = useSuspenseQuery(chartFollowsOptions);
  const categories = followedCategories(follows);
  const limit = useQuery(accountPlanOptions).data?.limits.chartFollows;

  return (
    <div className="flex flex-col gap-2">
      {limit === undefined ? null : (
        <p className="text-caption text-muted-foreground">
          {formatQuotaUsage({ used: categories.length, limit }, "followed")}
        </p>
      )}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories followed yet. Follow a category to have the daily run
          capture its charts.
        </p>
      ) : (
        <ul className="-mx-2 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {categories.map((category) => (
            <FollowRow
              key={category.follows[0].id}
              category={category}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function FollowedCharts() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <ListChecks aria-hidden />
          Followed charts
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <PopoverHeader>
          <PopoverTitle id={titleId}>Followed charts</PopoverTitle>
          <PopoverDescription id={descriptionId}>
            The daily run captures these every day.
          </PopoverDescription>
        </PopoverHeader>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <FollowList onNavigate={() => setOpen(false)} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

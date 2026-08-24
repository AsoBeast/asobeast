"use client";

import { Suspense } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import type { CompetitorDiscoveryItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { addCompetitor, ApiError } from "@/lib/api";
import { discoveryOptions, invalidateCompetitorMutation } from "@/lib/queries";
import { formatNumber, formatRating } from "@/lib/format";
import { DISCOVERY_WINDOWS } from "@/lib/ranges";
import { discoveryDaysParser } from "@/lib/search-params";
import { DiscoveryPanelSkeleton } from "./skeletons";

function TrackButton({
  id,
  item,
}: {
  id: string;
  item: CompetitorDiscoveryItem;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      addCompetitor(id, `https://apps.apple.com/us/app/id${item.storeAppId}`),
    onSuccess: (competitor) => {
      invalidateCompetitorMutation(queryClient, id);
      toast.success(`Now tracking ${competitor.name ?? item.title}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${item.title}`,
      );
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
      Track
    </Button>
  );
}

function DiscoveryTable({ id, days }: { id: string; days: number }) {
  const { data } = useSuspenseQuery(discoveryOptions(id, days));

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={`Nothing discovered in the last ${days} days`}
        body="As daily checks accumulate, apps that keep appearing in your keyword results but you do not track surface here. Widen the window to look further back."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableCaption className="sr-only">
          Untracked apps appearing in your keyword search results over the last{" "}
          {days} days.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead>Appearances</TableHead>
            <TableHead>Keywords</TableHead>
            <TableHead>Best</TableHead>
            <TableHead>Avg</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item) => (
            <TableRow key={item.storeAppId}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  {item.developer ? (
                    <span className="text-xs text-muted-foreground">
                      {item.developer}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="numeric font-mono">
                {item.appearances}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="numeric font-mono underline decoration-dotted underline-offset-4">
                      {item.keywordCount}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{item.keywords.join(", ")}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="numeric font-mono">
                {item.bestPosition}
              </TableCell>
              <TableCell className="numeric font-mono">
                {item.avgPosition}
              </TableCell>
              <TableCell className="numeric font-mono text-muted-foreground">
                {item.ratingAvg !== null
                  ? `${formatRating(item.ratingAvg)}${
                      item.ratingCount !== null
                        ? ` · ${formatNumber(item.ratingCount)}`
                        : ""
                    }`
                  : "—"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <TrackButton id={id} item={item} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DiscoveryPanel({ id }: { id: string }) {
  const [days, setDays] = useQueryState("days", discoveryDaysParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Discovery</CardDescription>
          <CardTitle>Apps you don’t track yet</CardTitle>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(next) => void setDays(Number(next) as typeof days)}
        >
          <TabsList>
            {DISCOVERY_WINDOWS.map((window) => (
              <TabsTrigger key={window} value={String(window)}>
                {window}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<DiscoveryPanelSkeleton />}>
          <DiscoveryTable id={id} days={days} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
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
import { appDetailOptions, discoveryOptions } from "@/lib/queries";
import { formatNumber, formatRating, storeLabel } from "@/lib/format";
import { DISCOVERY_WINDOWS } from "@/lib/ranges";
import { discoveryDaysParser } from "@/lib/search-params";
import { DiscoveryPanelSkeleton } from "./skeletons";
import { TrackButton } from "./TrackButton";

function DiscoveryTable({
  id,
  days,
  storeName,
}: {
  id: string;
  days: number;
  storeName: string;
}) {
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
          Untracked {storeName} apps appearing in your keyword search results
          over the last {days} days.
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
                  <TrackButton
                    id={id}
                    storeAppId={item.storeAppId}
                    title={item.title}
                  />
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
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const storeName = storeLabel(detail.store);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Discovery</CardDescription>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Apps you don’t track yet</CardTitle>
            <Badge variant="secondary">{storeName}</Badge>
          </div>
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
          <DiscoveryTable id={id} days={days} storeName={storeName} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

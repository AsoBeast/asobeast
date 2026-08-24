"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartNotice } from "@/components/charts/ChartStates";
import { CHART_HEIGHT, seriesColor } from "@/components/charts/theme";
import { appSummaryOptions } from "@/lib/queries";

const BUCKETS = [
  { key: "top1", label: "Top 1" },
  { key: "top3", label: "Top 3" },
  { key: "top10", label: "Top 10" },
  { key: "top50", label: "Top 50" },
  { key: "beyond", label: "Beyond" },
  { key: "unranked", label: "Unranked" },
] as const;

const chartConfig = {
  count: { label: "Keywords", color: seriesColor(1) },
} satisfies ChartConfig;

export function RankDistributionChart({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));
  const data = BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: summary.rankDistribution[bucket.key],
    muted: bucket.key === "unranked",
  }));

  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Rank distribution</CardDescription>
        <CardTitle>Where your keywords rank</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <ChartNotice
            height={CHART_HEIGHT.compact}
            title="No keywords tracked yet"
            body="Add keywords to see where this app ranks."
          />
        ) : (
          <ChartContainer
            config={chartConfig}
            className={`${CHART_HEIGHT.compact} w-full`}
            role="region"
            aria-label="Keyword rank distribution"
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 28 }}
            >
              <XAxis type="number" dataKey="count" hide />
              <YAxis
                type="category"
                dataKey="bucket"
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="count" radius={4}>
                {data.map((entry) => (
                  <Cell
                    key={entry.bucket}
                    fill="var(--color-count)"
                    fillOpacity={entry.muted ? 0.35 : 1}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

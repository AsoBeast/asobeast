"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { competitorsOptions } from "@/lib/queries";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { ComparisonMatrix } from "./ComparisonMatrix";
import { CompetitorList } from "./CompetitorList";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { ComparisonMatrixSkeleton, CompetitorListSkeleton } from "./skeletons";

function CompetitorListSection({ id }: { id: string }) {
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  if (competitors.length === 0) return null;
  return <CompetitorList id={id} competitors={competitors} />;
}

export function CompetitorsView({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>Competitors</CardDescription>
          <CardTitle>Track the apps you rank against</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCompetitorForm id={id} />
        </CardContent>
      </Card>

      <Suspense fallback={<CompetitorListSkeleton />}>
        <CompetitorListSection id={id} />
      </Suspense>

      <DiscoveryPanel id={id} />

      <Suspense fallback={<ComparisonMatrixSkeleton />}>
        <ComparisonMatrix id={id} />
      </Suspense>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { recentChangesOptions } from "@/lib/queries";
import { ChangeRow } from "./ChangeTimeline";
import { ChangeTimelineSkeleton } from "./skeletons";

function RecentChangesList() {
  const { data } = useSuspenseQuery(recentChangesOptions());

  if (data.events.length === 0) {
    return (
      <EmptyState
        title="No changes yet"
        body="Metadata changes across your portfolio appear after daily refreshes."
      />
    );
  }

  return (
    <div className="divide-y">
      {data.events.map((event) => (
        <Link
          key={event.id}
          href={`/apps/${event.appId}/changes`}
          className="block rounded-lg px-2 transition-colors hover:bg-muted/40"
        >
          <ChangeRow event={event} />
        </Link>
      ))}
    </div>
  );
}

export function RecentChangesCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Recent changes</CardDescription>
        <CardTitle>Across your portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeTimelineSkeleton />}>
          <RecentChangesList />
        </Suspense>
      </CardContent>
    </Card>
  );
}

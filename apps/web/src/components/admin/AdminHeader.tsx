"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@asobeast/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { countOf } from "@/lib/admin-stages";
import { formatNumber, formatUtcClock, pluralize } from "@/lib/format";
import { adminOverviewOptions } from "@/lib/queries";

function instanceFacts(overview: AdminOverview): string {
  const workspaces = pluralize(overview.workspaces.total, "workspace");
  const read = `read ${formatUtcClock(overview.generatedAt)}`;
  const middle = overview.billing
    ? [
        `${formatNumber(countOf(overview.workspaces.byStage, "trialing"))} on trial`,
        `${formatNumber(countOf(overview.workspaces.byStage, "paying"))} paying`,
      ]
    : [pluralize(overview.users.total, "account")];
  return [workspaces, ...middle, read].join(" · ");
}

export function AdminHeader() {
  const { data: overview } = useQuery(adminOverviewOptions);

  return (
    <PageHeader
      title="Admin"
      meta={overview ? instanceFacts(overview) : undefined}
    />
  );
}

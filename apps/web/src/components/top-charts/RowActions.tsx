"use client";

import Link from "next/link";
import type { ChartEntryItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { StoreLinkButton } from "@/components/StoreLinkButton";
import { useFocusClaim } from "@/lib/focus-handoff";
import { AddAsCompetitor } from "./AddAsCompetitor";
import {
  competitorFocusKey,
  rowLink,
  type ChartRowContext,
} from "./chart-actions";

export function RowActions({
  entry,
  context,
}: {
  entry: ChartEntryItem;
  context: ChartRowContext;
}) {
  const link = rowLink(context.links.get(entry.storeAppId));
  const claimFocus = useFocusClaim(competitorFocusKey(entry.storeAppId));

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      {link ? (
        <Badge
          asChild
          variant={link.role === "own" ? "info" : "secondary"}
          className="max-w-40 min-w-0 shrink"
        >
          <Link ref={claimFocus} href={link.href} title={link.label}>
            <span className="truncate">{link.label}</span>
          </Link>
        </Badge>
      ) : (
        <AddAsCompetitor
          storeAppId={entry.storeAppId}
          title={entry.title}
          apps={context.apps}
        />
      )}
      <StoreLinkButton
        store={context.chart.store}
        storeAppId={entry.storeAppId}
        country={context.chart.country}
        title={entry.title}
      />
    </div>
  );
}

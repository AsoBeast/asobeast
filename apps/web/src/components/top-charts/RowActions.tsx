import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { ChartEntryItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAsCompetitor } from "./AddAsCompetitor";
import { rowLink, storeUrl, type ChartRowContext } from "./chart-actions";

export function RowActions({
  entry,
  context,
}: {
  entry: ChartEntryItem;
  context: ChartRowContext;
}) {
  const link = rowLink(context.links.get(entry.storeAppId));

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      {link ? (
        <Badge
          asChild
          variant={link.role === "own" ? "info" : "secondary"}
          className="max-w-40 min-w-0 shrink"
        >
          <Link href={link.href} title={link.label}>
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
      <Button variant="ghost" size="icon-sm" asChild>
        <a
          href={storeUrl(
            context.chart.store,
            entry.storeAppId,
            context.chart.country,
          )}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${entry.title} in the store`}
        >
          <ExternalLink aria-hidden />
        </a>
      </Button>
    </div>
  );
}

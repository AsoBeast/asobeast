import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type {
  AppListItem,
  ChartAppLink,
  ChartEntryItem,
  ChartKey,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAsCompetitor } from "./AddAsCompetitor";
import { rowLink, storeUrl } from "./chart-actions";

export interface ChartRowContext {
  chart: ChartKey;
  links: ReadonlyMap<string, ChartAppLink>;
  apps: readonly AppListItem[];
}

export function RowActions({
  entry,
  context,
}: {
  entry: ChartEntryItem;
  context: ChartRowContext;
}) {
  const link = rowLink(context.links.get(entry.storeAppId));

  return (
    <div className="flex items-center justify-end gap-2">
      {link ? (
        <Badge asChild variant={link.role === "own" ? "info" : "secondary"}>
          <Link href={link.href}>{link.label}</Link>
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

"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { queueFilters } from "@/lib/action-filters";
import { formatNumber } from "@/lib/format";
import { actionsOptions } from "@/lib/queries";
import { PriorityBar } from "./PriorityBar";
import type { SetQueueView } from "./use-queue-view";
import { workByApp, workByMarket } from "./work-by-scope";

const SHOWN_SCOPES = 5;

export function ActionWorkByScope({
  appId,
  setView,
}: {
  appId?: string;
  setView: SetQueueView;
}) {
  const pathname = usePathname();
  const { data } = useQuery(actionsOptions(queueFilters(), appId));
  if (!data) return null;
  const facet = appId ? "market" : "app";
  const rows = (appId ? workByMarket : workByApp)(data.items);
  const hidden = rows.length - SHOWN_SCOPES;

  return (
    <section aria-labelledby="where-heading" className="flex flex-col gap-3">
      <h2 id="where-heading" className="text-title">
        Where the work is
      </h2>
      {rows.length === 0 ? (
        <p className="text-body text-muted-foreground">Nothing open.</p>
      ) : (
        <ul className="flex list-none flex-col gap-1 p-0">
          {rows.slice(0, SHOWN_SCOPES).map((row) => (
            <li key={row.key}>
              <a
                href={`${pathname}?${facet}=${encodeURIComponent(row.key)}`}
                onClick={(event) => {
                  event.preventDefault();
                  void setView({ [facet]: [row.key] }, { history: "replace" });
                }}
                className="grid min-h-10 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-body outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="truncate">{row.label}</span>
                <span className="numeric font-mono">
                  {formatNumber(row.total)}
                  <span className="sr-only"> open</span>
                </span>
                <span className="col-span-2">
                  <PriorityBar counts={row.counts} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <p className="text-caption text-muted-foreground">
          and {formatNumber(hidden)} more
        </p>
      ) : null}
      {data.total > data.items.length ? (
        <p className="text-caption text-muted-foreground">
          Counts cover the {formatNumber(data.items.length)} highest-impact
          actions.
        </p>
      ) : null}
    </section>
  );
}

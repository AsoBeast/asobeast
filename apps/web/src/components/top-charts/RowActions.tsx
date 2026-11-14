"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { ChartEntryItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { StoreLinkButton } from "@/components/StoreLinkButton";
import { useFocusClaim } from "@/lib/focus-handoff";
import { cn } from "@/lib/utils";
import { AddAsCompetitor } from "./AddAsCompetitor";
import {
  competitorFocusKey,
  rowLink,
  type ChartRowContext,
  type RowLink,
} from "./chart-actions";

export const ROW_REVEAL_GROUP = "group/chart-row";

export const OWN_ROW_BAR = "shadow-[inset_3px_0_0_var(--brand-mark)]";

const REVEALED =
  "md:opacity-0 md:transition-opacity md:duration-150 md:group-hover/chart-row:opacity-100 md:group-focus-within/chart-row:opacity-100 md:has-[[aria-expanded=true]]:opacity-100 md:has-[[aria-busy=true]]:opacity-100 md:pointer-coarse:opacity-100 motion-reduce:transition-none";

const COMPETITOR_LEAD = "Competitor";

function OwnerLink({
  link,
  compact,
  focusRef,
}: {
  link: RowLink;
  compact: boolean;
  focusRef: (node: HTMLElement | null) => void;
}) {
  if (link.role === "own") {
    return (
      <Badge asChild variant="brand" className="shrink-0">
        <Link ref={focusRef} href={link.href}>
          <span>{link.label}</span>
        </Link>
      </Badge>
    );
  }
  const rest = link.label.slice(COMPETITOR_LEAD.length);
  return (
    <Link
      ref={focusRef}
      href={link.href}
      title={link.label}
      className="min-w-0 shrink truncate rounded-sm text-caption text-faint-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{COMPETITOR_LEAD}</span>
      <span className={cn(compact && "sr-only")}>{rest}</span>
    </Link>
  );
}

function Revealed({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0", on && REVEALED)}>
      {children}
    </span>
  );
}

export function RowActions({
  entry,
  context,
  compact = false,
}: {
  entry: ChartEntryItem;
  context: ChartRowContext;
  compact?: boolean;
}) {
  const link = rowLink(context.links.get(entry.storeAppId));
  const claimFocus = useFocusClaim(competitorFocusKey(entry.storeAppId));

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      {link ? (
        <OwnerLink link={link} compact={compact} focusRef={claimFocus} />
      ) : (
        <Revealed on={compact}>
          <AddAsCompetitor
            storeAppId={entry.storeAppId}
            title={entry.title}
            apps={context.apps}
          />
        </Revealed>
      )}
      <Revealed on={compact}>
        <StoreLinkButton
          store={context.chart.store}
          storeAppId={entry.storeAppId}
          country={context.chart.country}
          title={entry.title}
        />
      </Revealed>
    </div>
  );
}

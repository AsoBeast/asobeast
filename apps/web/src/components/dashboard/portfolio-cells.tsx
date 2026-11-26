"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PortfolioApp, PortfolioAppHistory } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { TrendLine } from "@/components/charts/Sparkline";
import { DelistedBadge } from "@/components/apps/DelistedBadge";
import {
  SortableHeader,
  type SortableColumn,
} from "@/components/data-table/SortableHeader";
import { Badge } from "@/components/ui/badge";
import { Separated } from "@/components/ui/separated";
import { storeLabel } from "@/lib/format";
import { setupChipText } from "./setup-chip";
import { useDashboardRange } from "./use-range-history";

export function VisibilityTrend({
  points,
  days,
}: {
  points: PortfolioAppHistory["points"];
  days: number;
}) {
  const t = useTranslations("dashboard");
  const values = points.map((point) => point.visibility);
  return (
    <TrendLine
      values={values}
      label={t("table.visibilityTrend", { days })}
      now={String(Math.round(values.at(-1) ?? 0))}
    />
  );
}

export function RangeLabel({ kind }: { kind: "trend" | "change" | "moved" }) {
  const t = useTranslations("dashboard");
  const { days } = useDashboardRange();
  return (
    <span>
      {t(`table.${kind}Header`, {
        range: t("table.rangeUnit", { days }),
      })}
    </span>
  );
}

export function ChangeHeader({ column }: { column: SortableColumn }) {
  return (
    <SortableHeader column={column} label={<RangeLabel kind="change" />} />
  );
}

export function AppCell({ app }: { app: PortfolioApp }) {
  const t = useTranslations("dashboard");
  const name = app.name ?? t("table.untitled");
  const setup = setupChipText(app.setup, t);
  const meta = [
    storeLabel(app.store),
    app.country.toUpperCase(),
    t("counts.keywords", { count: app.trackedKeywords }),
    app.groupName,
  ].filter((part) => part !== null);
  return (
    <div className="flex max-w-44 min-w-0 items-center gap-3 @xl/dashboard:max-w-72">
      <AppIcon src={app.iconUrl} size={24} />
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/apps/${app.id}`}
          className="-my-[3px] flex min-h-6 min-w-0 items-center font-medium underline-offset-4 hover:underline"
        >
          <span className="truncate">{name}</span>
        </Link>
        <span className="truncate text-label text-muted-foreground">
          <Separated parts={meta} />
        </span>
        {app.delistedAt ? <DelistedBadge since={app.delistedAt} /> : null}
        {setup ? (
          <Badge variant="info" asChild className="mt-0.5 min-h-6">
            <Link href={`/apps/${app.id}/setup`}>{setup}</Link>
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

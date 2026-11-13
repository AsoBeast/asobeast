import type { ComponentProps, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TILE_SHAPE =
  "row-span-3 grid grid-rows-subgrid gap-1 bg-card px-5 pt-3.5 pb-4 shadow-[-1px_0_0_var(--border),0_-1px_0_var(--border)]";

export type MetricStripColumns = 2 | 3 | 4;

const STRIP_COLUMNS: Record<MetricStripColumns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 @lg/metric-strip:grid-cols-3",
  4: "grid-cols-2 @3xl/metric-strip:grid-cols-4",
};

export function StatTileGroup({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-tile-group"
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MetricStrip({
  columns,
  framed = true,
  label,
  children,
}: {
  columns: MetricStripColumns;
  framed?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="@container/metric-strip">
      <StatTileGroup
        role={label ? "group" : undefined}
        aria-label={label}
        className={cn(
          STRIP_COLUMNS[columns],
          !framed && "rounded-none border-0",
        )}
      >
        {children}
      </StatTileGroup>
    </div>
  );
}

export function StatTile({
  label,
  value,
  delta,
  note,
  info,
  selected,
  onSelect,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  note?: ReactNode;
  info?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const Tile = onSelect ? "button" : "div";
  return (
    <Tile
      data-slot="stat-tile"
      data-selected={selected}
      {...(onSelect
        ? { type: "button", onClick: onSelect, "aria-pressed": !!selected }
        : {})}
      className={cn(
        TILE_SHAPE,
        onSelect &&
          "text-left transition-colors duration-150 ease-out outline-hidden hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[selected=true]:shadow-[-1px_0_0_var(--border),0_-1px_0_var(--border),inset_0_-2px_0_var(--brand-mark)]",
        className,
      )}
    >
      <span className="text-label text-balance text-muted-foreground">
        {label}
        {info ? <span className="ml-1">{info}</span> : null}
      </span>
      <span className="numeric self-end text-metric">
        <span className="flex flex-wrap items-center gap-2">
          <span>{value}</span>
          {delta}
        </span>
      </span>
      <span className="text-caption text-balance text-faint-foreground">
        {note}
      </span>
    </Tile>
  );
}

function SkeletonLine({ step, width }: { step: string; width: string }) {
  return (
    <div className={step}>
      <Skeleton
        shape="text"
        className={cn("inline-block align-middle", width)}
      />
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div data-slot="stat-tile-skeleton" aria-hidden className={TILE_SHAPE}>
      <SkeletonLine step="text-label" width="w-24" />
      <SkeletonLine step="self-end text-metric" width="w-12" />
      <SkeletonLine step="text-caption" width="w-28" />
    </div>
  );
}

export function MetricStripSkeleton({
  columns,
  framed,
}: {
  columns: MetricStripColumns;
  framed?: boolean;
}) {
  return (
    <MetricStrip columns={columns} framed={framed}>
      {Array.from({ length: columns }).map((_, index) => (
        <StatTileSkeleton key={index} />
      ))}
    </MetricStrip>
  );
}

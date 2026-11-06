import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTileGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="stat-tile-group"
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  note,
  info,
  selected,
  onSelect,
  className,
}: {
  label: string;
  value: ReactNode;
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
        "row-span-3 -mr-px -mb-px grid grid-rows-subgrid gap-1 border-r border-b border-border bg-card px-5 pt-3.5 pb-4",
        onSelect &&
          "cursor-pointer text-left transition-colors duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[selected=true]:shadow-[inset_0_-2px_0_var(--foreground)]",
        className,
      )}
    >
      <span className="text-label text-balance text-muted-foreground">
        {label}
        {info ? <span className="ml-1">{info}</span> : null}
      </span>
      <span className="numeric self-end text-metric">{value}</span>
      <span className="text-caption text-balance text-faint-foreground">
        {note}
      </span>
    </Tile>
  );
}

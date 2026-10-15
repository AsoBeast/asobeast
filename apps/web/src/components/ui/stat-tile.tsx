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
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3",
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
        "row-span-3 grid grid-rows-subgrid gap-1 rounded-xl border bg-card px-4 py-3",
        onSelect &&
          "cursor-pointer text-left transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[selected=true]:border-primary data-[selected=true]:ring-2 data-[selected=true]:ring-primary",
        className,
      )}
    >
      <span className="text-label text-balance text-muted-foreground uppercase">
        {label}
        {info ? <span className="ml-1 normal-case">{info}</span> : null}
      </span>
      <span className="numeric self-end font-mono text-display">{value}</span>
      <span className="text-caption text-balance text-muted-foreground">
        {note}
      </span>
    </Tile>
  );
}

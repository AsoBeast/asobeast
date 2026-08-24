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
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "row-span-3 grid grid-rows-subgrid gap-1 rounded-xl border bg-card px-4 py-3",
        className,
      )}
    >
      <span className="text-label text-balance text-muted-foreground uppercase">
        {label}
      </span>
      <span className="numeric self-end font-mono text-display">{value}</span>
      <span className="text-caption text-balance text-muted-foreground">
        {note}
      </span>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { DeltaChip } from "@/components/ui/delta-chip";
import { movementText, type Moved } from "./movement-text";

function Shown({
  entry,
  period,
  compact,
}: {
  entry: Moved;
  period: string;
  compact: boolean;
}) {
  if (entry.movement === "new") return <Badge variant="info">New</Badge>;
  if (entry.movement === "none" || entry.movement === "same") {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <DeltaChip value={entry.delta} period={period} />
      {compact ? null : (
        <span className="text-caption text-muted-foreground">
          from #{entry.previous}
        </span>
      )}
    </span>
  );
}

export function MovementCell({
  entry,
  period,
  noneText,
  compact = false,
}: {
  entry: Moved;
  period: string;
  noneText?: string;
  compact?: boolean;
}) {
  return (
    <>
      <span aria-hidden>
        <Shown entry={entry} period={period} compact={compact} />
      </span>
      <span className="sr-only">{movementText(entry, noneText)}</span>
    </>
  );
}

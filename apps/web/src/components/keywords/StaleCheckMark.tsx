import { History } from "lucide-react";
import { staleCheckLabel, staleCheckLine } from "./stale-check";

export function StaleCheckMark({ day }: { day: string }) {
  return (
    <span
      data-slot="stale-check"
      title={staleCheckLine(day)}
      className="inline-flex shrink-0 text-muted-foreground"
    >
      <History aria-hidden className="size-3.5" />
      <span className="sr-only">{staleCheckLabel(day)}</span>
    </span>
  );
}

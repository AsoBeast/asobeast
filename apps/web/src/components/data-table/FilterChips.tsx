import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: readonly FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <ul
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-2"
    >
      {chips.map((chip) => (
        <li key={chip.key}>
          <Badge variant="secondary" className="h-6 gap-1 pr-0.5">
            {chip.label}
            <button
              type="button"
              aria-label={`Remove ${chip.label}`}
              onClick={chip.onRemove}
              className="inline-flex size-5 items-center justify-center rounded-full opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
      {chips.length > 1 ? (
        <li>
          <Button variant="ghost" size="xs" onClick={onClearAll}>
            Clear all
          </Button>
        </li>
      ) : null}
    </ul>
  );
}

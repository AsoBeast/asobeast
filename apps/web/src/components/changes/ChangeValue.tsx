import type { ChangeEventItem } from "@asobeast/shared";
import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { releaseNotesInline } from "./release-notes";
import { hasScreenshotDetail } from "./screenshot-change";
import { ScreenshotChangeValue } from "./ScreenshotChangeValue";

function text(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}

function chars(value: string | null): string {
  return value === null ? "—" : `${formatNumber(Number(value))} chars`;
}

function price(
  value: string | null,
  currency: string | null | undefined,
): string {
  return value === null ? "—" : formatPrice(Number(value), currency);
}

function inlineNotes(value: string | null): string {
  return value === null ? "—" : text(releaseNotesInline(value));
}

function count(value: string | null): string {
  return value === null ? "—" : formatNumber(Number(value));
}

export function ChangeValue({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  const { field, before, after } = event;

  if (hasScreenshotDetail(event)) {
    return <ScreenshotChangeValue event={event} dense={dense} />;
  }

  if (field === "icon") {
    return <span className="text-muted-foreground">Icon updated</span>;
  }

  if (field === "whatsNew") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="break-words">
            <span className="text-muted-foreground">
              {CHANGE_FIELD_LABELS.whatsNew} updated:{" "}
            </span>
            <span
              className={cn(
                "font-medium",
                dense ? null : "block whitespace-pre-line",
              )}
            >
              {dense ? inlineNotes(after) : text(after)}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Previous: {inlineNotes(before)}
        </TooltipContent>
      </Tooltip>
    );
  }

  let from: string;
  let to: string;
  if (field === "summary" || field === "description") {
    from = chars(before);
    to = chars(after);
  } else if (field === "price") {
    from = price(before, event.currency);
    to = price(after, event.currency);
  } else if (field === "screenshots") {
    from = count(before);
    to = count(after);
  } else {
    from = text(before);
    to = text(after);
  }

  if (dense) {
    return (
      <span className="break-words">
        <span className="text-muted-foreground line-through">{from}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <span className="font-medium">{to}</span>
      </span>
    );
  }

  return (
    <span className="grid gap-1 sm:grid-cols-2">
      <span className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-2 py-1">
        <span className="text-label text-muted-foreground">Before</span>
        <span className="break-words text-muted-foreground">{from}</span>
      </span>
      <span className="flex flex-col gap-0.5 rounded-md bg-success-subtle px-2 py-1">
        <span className="text-label text-muted-foreground">After</span>
        <span className="break-words font-medium">{to}</span>
      </span>
    </span>
  );
}

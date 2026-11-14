import type { ChangeEventItem, ScreenshotRef } from "@asobeast/shared";
import { ScreenshotThumb } from "@/components/screenshots/ScreenshotThumb";
import { cn } from "@/lib/utils";
import { screenshotChangeSummary } from "./screenshot-change";

const THUMB_HEIGHT = 96;

function Strip({
  label,
  refs,
  marked,
  ring,
}: {
  label: string;
  refs: ScreenshotRef[];
  marked: number[];
  ring: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="text-label text-faint-foreground">{label}</span>
      <span
        role="group"
        aria-label={`${label} screenshots`}
        tabIndex={0}
        className="flex gap-2 overflow-x-auto p-1"
      >
        {refs.map((ref) => (
          <ScreenshotThumb
            key={ref.position}
            src={ref.url}
            alt={`${label}, screenshot ${ref.position}`}
            height={THUMB_HEIGHT}
            className={cn(marked.includes(ref.position) && `ring-2 ${ring}`)}
          />
        ))}
      </span>
    </span>
  );
}

function CaptionList({
  label,
  captions,
  tone,
}: {
  label: string;
  captions: string[];
  tone: string;
}) {
  if (captions.length === 0) return null;
  return (
    <span className="flex gap-3">
      <span className="w-16 shrink-0 text-label text-faint-foreground">
        {label}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {captions.map((caption, index) => (
          <span
            key={`${index}-${caption}`}
            className={cn("wrap-anywhere", tone)}
          >
            {caption}
          </span>
        ))}
      </span>
    </span>
  );
}

export function ScreenshotChangeValue({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  const detail = event.detail;
  const summary = screenshotChangeSummary(event);

  if (dense || !detail) {
    return <span className="break-words">{summary}</span>;
  }

  if (detail.kind === "captions") {
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <CaptionList
          label="Removed"
          captions={detail.removed}
          tone="text-muted-foreground line-through"
        />
        <CaptionList label="Added" captions={detail.added} tone="font-medium" />
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-col gap-2">
      <span className="break-words">{summary}</span>
      <span className="flex min-w-0 flex-wrap gap-x-6 gap-y-2">
        <Strip
          label="Before"
          refs={detail.before}
          marked={detail.removed}
          ring="ring-destructive"
        />
        <Strip
          label="After"
          refs={detail.after}
          marked={detail.added}
          ring="ring-success"
        />
      </span>
    </span>
  );
}

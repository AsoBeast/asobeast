import type { ChangeEventItem, ScreenshotRef } from "@asobeast/shared";
import { ScreenshotThumb } from "@/components/screenshots/ScreenshotThumb";
import { cn } from "@/lib/utils";
import { screenshotChangeSummary } from "./screenshot-change";

const THUMB_WIDTH = 56;

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
    <span className="flex flex-col gap-1">
      <span className="text-label text-muted-foreground uppercase">
        {label}
      </span>
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
            width={THUMB_WIDTH}
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
    <span className={cn("flex flex-col gap-0.5 rounded-md px-2 py-1", tone)}>
      <span className="text-label text-muted-foreground uppercase">
        {label}
      </span>
      {captions.map((caption, index) => (
        <span key={`${index}-${caption}`} className="font-medium break-words">
          {caption}
        </span>
      ))}
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
      <span className="grid gap-1 sm:grid-cols-2">
        <CaptionList
          label="Removed"
          captions={detail.removed}
          tone="bg-muted/50"
        />
        <CaptionList
          label="Added"
          captions={detail.added}
          tone="bg-success-subtle"
        />
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-col gap-2">
      <span className="break-words">{summary}</span>
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
  );
}

import { cn } from "@/lib/utils";

const MARK = {
  on: "bg-foreground",
  off: "inset-ring-[1.5px] inset-ring-faint-foreground",
  warning:
    "bg-linear-to-r from-warning from-50% to-transparent to-50% inset-ring-[1.5px] inset-ring-warning",
} as const;

const TEXT = {
  on: "text-foreground",
  off: "text-muted-foreground",
  warning: "text-warning",
} as const;

export type StateTone = keyof typeof MARK;

export function StateWord({
  tone,
  children,
}: {
  tone: StateTone;
  children: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-label whitespace-nowrap",
        TEXT[tone],
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", MARK[tone])}
      />
      <span>{children}</span>
    </span>
  );
}

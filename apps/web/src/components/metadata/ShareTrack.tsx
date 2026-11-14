import { cn } from "@/lib/utils";

const PERCENT = 100;

export function ShareTrack({
  share,
  className,
}: {
  share: number;
  className?: string;
}) {
  const width = Math.round(Math.min(Math.max(share, 0), 1) * PERCENT);
  return (
    <span
      aria-hidden
      className={cn(
        "block h-2 overflow-hidden rounded-full border border-border print:hidden",
        className,
      )}
    >
      <span
        data-slot="share-bar"
        className="block h-full bg-chart-tint"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

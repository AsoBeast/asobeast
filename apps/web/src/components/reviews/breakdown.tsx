import { LIST_ROW } from "@/components/layout/panel-classes";

const BAR_MAX_PERCENT = 60;
const BAR_MIN_PERCENT = 2;

export const BREAKDOWN_STATIC_ROW =
  "relative h-10 items-center text-dense sm:h-9";

export const BREAKDOWN_BUTTON_ROW = `${LIST_ROW} w-full text-left aria-pressed:bg-muted aria-pressed:shadow-[inset_2px_0_0_var(--foreground)]`;

export function BreakdownBar({ share }: { share: number }) {
  const width = Math.max(BAR_MIN_PERCENT, Math.round(share * BAR_MAX_PERCENT));
  return (
    <span
      aria-hidden
      className="absolute inset-y-1 left-0 rounded-md bg-chart-tint"
      style={{ width: `${width}%` }}
    />
  );
}

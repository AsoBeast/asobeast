import { Meter } from "@/components/ui/meter";
import { ACTION_IMPACT_CAPTION } from "./action-copy";

export function ActionImpactMeter({ impact }: { impact: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Estimated impact"
        aria-valuenow={impact}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${impact} of 100 estimated impact`}
        title={ACTION_IMPACT_CAPTION}
        className="w-24"
      >
        <Meter value={impact} tone="opportunity" />
      </div>
      <span className="numeric font-mono text-caption text-muted-foreground">
        {impact}
        <span className="sr-only"> of 100</span> estimated impact
      </span>
    </div>
  );
}

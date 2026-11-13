import { ACTION_IMPACT_CAPTION } from "./action-copy";

export function ImpactFigure({
  impact,
  labelled = false,
  className,
}: {
  impact: number;
  labelled?: boolean;
  className?: string;
}) {
  return (
    <span title={ACTION_IMPACT_CAPTION} className={className}>
      {labelled ? (
        <span
          aria-hidden
          className="block text-right text-label text-faint-foreground"
        >
          Impact
        </span>
      ) : null}
      <span className="numeric block text-right text-dense font-medium">
        <span>{impact}</span>
        <span className="sr-only"> of 100 estimated impact</span>
      </span>
    </span>
  );
}

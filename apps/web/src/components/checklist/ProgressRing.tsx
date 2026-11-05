import { ringFraction } from "./checklist-progress";

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const filled = ringFraction(done, total) * CIRCUMFERENCE;
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="size-5 shrink-0 -rotate-90"
      fill="none"
      strokeWidth={3}
    >
      <circle cx={10} cy={10} r={RADIUS} className="stroke-muted" />
      <circle
        cx={10}
        cy={10}
        r={RADIUS}
        className="stroke-success"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
      />
    </svg>
  );
}

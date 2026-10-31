import type { PortfolioMovement } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

export function MovementValue({ movement }: { movement: PortfolioMovement }) {
  return (
    <>
      <span aria-hidden>
        <span className="text-signal-up">↑</span>
        <span>{`${formatNumber(movement.up)} `}</span>
        <span className="text-signal-down">↓</span>
        <span>{formatNumber(movement.down)}</span>
      </span>
      <span className="sr-only">
        {`${movement.up} climbing, ${movement.down} falling`}
      </span>
    </>
  );
}

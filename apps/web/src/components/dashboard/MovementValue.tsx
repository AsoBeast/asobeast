import type { PortfolioMovement } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

export function MovementValue({ movement }: { movement: PortfolioMovement }) {
  return (
    <>
      <span aria-hidden>
        <span className="text-signal-up">↑</span>
        {formatNumber(movement.up)} <span className="text-signal-down">↓</span>
        {formatNumber(movement.down)}
      </span>
      <span className="sr-only">
        {movement.up} climbing, {movement.down} falling
      </span>
    </>
  );
}

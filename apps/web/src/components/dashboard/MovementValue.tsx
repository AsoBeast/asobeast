import type { PortfolioMovement } from "@asobeast/shared";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatNumber } from "@/lib/format";

export function MovementValue({ movement }: { movement: PortfolioMovement }) {
  return (
    <>
      <span aria-hidden className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-0.5">
          <DirectionArrow way="up" className="text-signal-up" />
          <span>{formatNumber(movement.up)}</span>
        </span>
        <span className="inline-flex items-center gap-0.5">
          <DirectionArrow way="down" className="text-signal-down" />
          <span>{formatNumber(movement.down)}</span>
        </span>
      </span>
      <span className="sr-only">
        {`${movement.up} climbing, ${movement.down} falling`}
      </span>
    </>
  );
}

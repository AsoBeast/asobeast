import type { PortfolioMovement } from "@asobeast/shared";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatNumber } from "@/lib/format";

type Moved = Pick<PortfolioMovement, "up" | "down">;

function Side({ way, count }: { way: "up" | "down"; count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <DirectionArrow
        way={way}
        className={way === "up" ? "text-signal-up" : "text-signal-down"}
      />
      <span>{formatNumber(count)}</span>
    </span>
  );
}

export function MovementValue({ movement }: { movement: Moved }) {
  const quiet = movement.up + movement.down === 0;
  return (
    <>
      <span aria-hidden className="inline-flex items-center gap-2">
        {quiet ? <span className="text-muted-foreground">0</span> : null}
        <Side way="up" count={movement.up} />
        <Side way="down" count={movement.down} />
      </span>
      <span className="sr-only">
        {`${movement.up} climbing, ${movement.down} falling`}
      </span>
    </>
  );
}

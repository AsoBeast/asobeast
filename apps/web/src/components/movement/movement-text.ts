import type { ChartMovement } from "@asobeast/shared";

export interface Moved {
  movement: ChartMovement;
  delta: number | null;
  previous: number | null;
}

export function movementText(
  { movement, delta, previous }: Moved,
  noneText = "No earlier capture",
): string {
  if (movement === "up") return `Up ${Math.abs(delta ?? 0)} from #${previous}`;
  if (movement === "down") return `Down ${delta} from #${previous}`;
  if (movement === "same") return "No change";
  if (movement === "new") return "New entry";
  return noneText;
}

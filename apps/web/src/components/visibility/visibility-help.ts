import { positionWeight, toVolume, UNSCORED_TRAFFIC } from "@asobeast/shared";

export const VISIBILITY_GUIDE = "https://docs.asobeast.com/concepts/visibility";

const EXAMPLE_POSITIONS: (number | null)[] = [1, 3, 10, 50, 100, null];

export const POSITION_SHARES = EXAMPLE_POSITIONS.map((position) => ({
  position: position === null ? "Not found" : String(position),
  share: `${Math.round(positionWeight(position) * 100)}%`,
}));

export const UNSCORED_POPULARITY = toVolume(UNSCORED_TRAFFIC);

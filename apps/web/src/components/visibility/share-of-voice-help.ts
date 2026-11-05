import { visibility } from "@asobeast/shared";

const EXAMPLE_TRAFFIC = [8, 5, 3];

const visibilityAt = (positions: readonly (number | null)[]) =>
  visibility(
    EXAMPLE_TRAFFIC.map((traffic, index) => ({
      traffic,
      position: positions[index] ?? null,
    })),
  );

const percent = (part: number, whole: number) =>
  `${(Math.round((part / whole) * 1000) / 10).toFixed(1)}%`;

const you = visibilityAt([3, 12, null]);
const first = visibilityAt([9, 4, 8]);
const second = visibilityAt([null, null, 2]);

export const SHARE_EXAMPLE = {
  you,
  rivals: [first, second],
  share: percent(you, you + first + second),
  againstOne: percent(you, you + first),
} as const;

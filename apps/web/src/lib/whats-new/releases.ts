import { FIRST_RELEASES } from "./first-releases";
import { LATER_RELEASES } from "./later-releases";
import type { Release } from "./release-notes";

export const RELEASES: readonly Release[] = [
  ...LATER_RELEASES,
  ...FIRST_RELEASES,
];

export const COMPETITOR_SECTION = {
  tracked: "competitors.tracked",
  gaps: "competitors.gaps",
  discovery: "competitors.discovery",
  matrix: "competitors.matrix",
} as const;

export const COMPETITOR_SECTIONS: readonly string[] =
  Object.values(COMPETITOR_SECTION);

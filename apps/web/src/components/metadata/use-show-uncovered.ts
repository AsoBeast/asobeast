"use client";

import { useQueryState } from "nuqs";
import { coverageFilterParsers } from "@/lib/search-params";
import { COVERAGE_SECTION_ID } from "./coverage-summary";

export function useShowUncovered(): () => void {
  const [, setUncovered] = useQueryState(
    "uncovered",
    coverageFilterParsers.uncovered,
  );
  return () => {
    void setUncovered(true);
    document
      .getElementById(COVERAGE_SECTION_ID)
      ?.scrollIntoView({ block: "start" });
  };
}

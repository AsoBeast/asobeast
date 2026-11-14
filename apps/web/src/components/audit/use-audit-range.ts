"use client";

import { useDeferredValue } from "react";
import { useQueryState } from "nuqs";
import type { VisibilityRange } from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

export function useAuditRange(): {
  range: VisibilityRange;
  shownRange: VisibilityRange;
  setRange: (next: VisibilityRange) => void;
} {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);
  const shownRange = useDeferredValue(range);
  return { range, shownRange, setRange: (next) => void setRange(next) };
}

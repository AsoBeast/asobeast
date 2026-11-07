import { useState } from "react";
import type { ViewerClock } from "@/lib/plan-choice";
import { useHydrated } from "@/lib/use-hydrated";

export function useViewerClock(): ViewerClock {
  const [now] = useState(() => new Date());
  const timeZone = useHydrated()
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";
  return { now, timeZone };
}

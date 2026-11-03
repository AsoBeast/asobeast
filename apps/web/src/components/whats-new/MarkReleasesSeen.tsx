"use client";

import { useEffect } from "react";
import { useSeenRelease } from "@/lib/whats-new/seen-release";

export function MarkReleasesSeen({ version }: { version: string | null }) {
  const [, markSeen] = useSeenRelease();

  useEffect(() => {
    if (version) markSeen(version);
  }, [version, markSeen]);

  return null;
}

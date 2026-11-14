"use client";

import { type RefObject, useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppAuditResult } from "@asobeast/shared";
import { invalidateAiUsage, invalidateAudit } from "@/lib/queries";

const ELAPSED_TICK_MS = 1_000;

const subscribeClock = (tick: () => void): (() => void) => {
  const timer = setInterval(tick, ELAPSED_TICK_MS);
  return () => clearInterval(timer);
};

const subscribeNever = (): (() => void) => () => undefined;

const clockSeconds = (): number => Math.floor(Date.now() / 1000);

const serverClock = (): null => null;

export function useElapsed(
  active: boolean,
  requestedAt: string | null,
): number | null {
  const now = useSyncExternalStore(
    active ? subscribeClock : subscribeNever,
    clockSeconds,
    serverClock,
  );
  if (!active || requestedAt === null || now === null) return null;
  return Math.max(0, now - Math.floor(Date.parse(requestedAt) / 1000));
}

export function useFocusWhenQueued(
  requesting: boolean,
  active: boolean,
): RefObject<HTMLHeadingElement | null> {
  const heading = useRef<HTMLHeadingElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requesting) {
      requested.current = true;
      return;
    }
    if (requested.current && active) heading.current?.focus();
    requested.current = false;
  }, [requesting, active]);

  return heading;
}

export function useRunTransitions(appId: string, audit: AppAuditResult): void {
  const queryClient = useQueryClient();
  const previous = useRef(audit.ai.run?.state ?? null);
  const overall = useRef(audit.overall);

  useEffect(() => {
    const state = audit.ai.run?.state ?? null;
    const was = previous.current;
    previous.current = state;
    const wasActive = was === "queued" || was === "running";
    if (!wasActive) {
      overall.current = audit.overall;
      return;
    }
    if (state === "completed") {
      toast.success("Creative analysis finished", {
        description: `Score ${overall.current ?? "—"} to ${audit.overall ?? "—"}`,
      });
      void invalidateAudit(queryClient, appId);
      invalidateAiUsage(queryClient);
    }
    if (state === "failed") {
      toast.error("Creative analysis failed", {
        description: audit.ai.run?.error ?? undefined,
      });
      invalidateAiUsage(queryClient);
    }
    overall.current = audit.overall;
  }, [
    appId,
    audit.ai.run?.state,
    audit.ai.run?.error,
    audit.overall,
    queryClient,
  ]);
}

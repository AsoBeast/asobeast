"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@asobeast/shared";
import { authMeOptions, authStatusOptions } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";

export function useLeaveFor(
  destinationOf: (user: AuthUser) => string | null,
  options: typeof authMeOptions = authMeOptions,
): boolean {
  const hydrated = useHydrated();
  const { data: status } = useQuery(authStatusOptions);
  const {
    data: user,
    isRefetchError,
    fetchStatus,
  } = useQuery({
    ...options,
    enabled: Boolean(status?.authenticated),
  });
  const answerIsCurrent = !isRefetchError && fetchStatus === "idle";
  const destination =
    hydrated && user && answerIsCurrent ? destinationOf(user) : null;
  const left = useRef(false);

  useEffect(() => {
    if (destination === null || left.current) return;
    left.current = true;
    window.location.replace(destination);
  }, [destination]);

  return destination !== null;
}

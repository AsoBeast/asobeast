"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FirstRun } from "@/components/apps/FirstRun";
import { portfolioOptions } from "@/lib/queries";

export function FirstRunGate({ children }: { children: ReactNode }) {
  const { data } = useSuspenseQuery(portfolioOptions);
  return data.apps.length === 0 ? <FirstRun /> : children;
}

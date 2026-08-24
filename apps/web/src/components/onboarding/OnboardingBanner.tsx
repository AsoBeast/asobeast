"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  dismissOnboarding,
  getOnboardingSnapshot,
  getServerOnboardingSnapshot,
  parseOnboardingState,
  saveOnboardingState,
  subscribeOnboarding,
} from "@/lib/onboarding";
import { portfolioOptions } from "@/lib/queries";

export function OnboardingBanner() {
  const snapshot = useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingSnapshot,
    getServerOnboardingSnapshot,
  );
  const state = useMemo(() => parseOnboardingState(snapshot), [snapshot]);
  const { data } = useSuspenseQuery(portfolioOptions);
  if (state.status !== "in_progress" || !state.appId) return null;

  const app = data.apps.find((item) => item.id === state.appId);
  const name = app?.name ?? "your app";

  return (
    <Alert
      role="status"
      className="items-center gap-y-3 sm:grid-cols-[auto_1fr_auto]"
    >
      <ListChecks />
      <AlertDescription>
        Finish setting up {name}. Your checklist progress is saved in this
        browser.
      </AlertDescription>
      <div className="col-span-full flex flex-wrap gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2">
        <Button asChild size="sm">
          <Link href={`/apps/${state.appId}/setup`}>Resume setup</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => saveOnboardingState(dismissOnboarding(state))}
        >
          Dismiss
        </Button>
      </div>
    </Alert>
  );
}

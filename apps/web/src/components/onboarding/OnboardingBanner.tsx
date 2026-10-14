"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  dismissOnboarding,
  setupProgress,
  type OnboardingState,
} from "@/lib/onboarding";
import {
  competitorsOptions,
  keywordsOptions,
  portfolioOptions,
} from "@/lib/queries";
import {
  loadingSentence,
  progressPercent,
  progressSentence,
} from "./setup-progress";
import { useOnboarding } from "./use-onboarding";

export function OnboardingBanner() {
  const { state, persist } = useOnboarding();
  const { data } = useSuspenseQuery(portfolioOptions);
  if (state.status !== "in_progress" || !state.appId) return null;

  const app = data.apps.find((item) => item.id === state.appId);

  return (
    <Alert
      role="status"
      className="items-center gap-y-3 sm:grid-cols-[auto_1fr_auto]"
    >
      <ListChecks />
      <AlertDescription className="flex flex-col gap-2">
        <BannerProgress
          appId={state.appId}
          country={app?.country ?? null}
          name={app?.name ?? null}
          state={state}
        />
      </AlertDescription>
      <div className="col-span-full flex flex-wrap gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2">
        <Button asChild size="sm">
          <Link href={`/apps/${state.appId}/setup`}>Resume setup</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => persist(dismissOnboarding)}
        >
          Dismiss
        </Button>
      </div>
    </Alert>
  );
}

function BannerProgress({
  appId,
  country,
  name,
  state,
}: {
  appId: string;
  country: string | null;
  name: string | null;
  state: OnboardingState;
}) {
  const competitors = useQuery(competitorsOptions(appId));
  const keywords = useQuery({
    ...keywordsOptions(appId, country ?? ""),
    enabled: country !== null,
  });
  if (!competitors.data || !keywords.data) {
    return <span>{loadingSentence(name)}</span>;
  }
  const progress = setupProgress(state, {
    competitors: competitors.data.length,
    keywords: keywords.data.filter((keyword) => keyword.active).length,
  });

  return (
    <>
      <span>{progressSentence(name, progress)}</span>
      <Progress
        value={progressPercent(progress)}
        aria-label="Setup progress"
        getValueLabel={() => `${progress.done} of ${progress.total} steps`}
        className="max-w-xs"
      />
    </>
  );
}

"use client";

import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { AppDetail } from "@asobeast/shared";
import { ErrorState } from "@/components/layout/ErrorState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canCompleteOnboarding,
  completeOnboarding,
  dismissOnboarding,
  restartOnboarding,
  setCountriesReviewed,
  setMarketSelected,
  setStepSkipped,
  stepState,
  type OnboardingState,
  type SetupCounts,
  type SetupStep,
} from "@/lib/onboarding";
import {
  appDetailOptions,
  competitorsOptions,
  keywordsOptions,
  marketSuggestionsOptions,
} from "@/lib/queries";
import { CompetitorsStep, CountriesStep, KeywordsStep } from "./setup-steps";
import { SetupChecklistSkeleton } from "./SetupChecklistSkeleton";
import { useFirstRunDiscovery } from "./use-first-run-discovery";
import { useOnboarding, type OnboardingTransition } from "./use-onboarding";

type Persist = (transition: OnboardingTransition) => void;
type LiveQuery = { data: unknown; isError: boolean; refetch: () => unknown };

const lengthOrNull = <T,>(value: T[] | undefined): number | null =>
  value ? value.length : null;

const activeCount = (
  keywords: { active: boolean }[] | undefined,
): number | null =>
  keywords ? keywords.filter((keyword) => keyword.active).length : null;

export function SetupChecklist({ id }: { id: string }) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { account, state, persist, userError, retryUser } = useOnboarding();
  const start = () => persist(() => restartOnboarding(id, app.country));

  if (userError) {
    return (
      <ErrorState
        error={userError}
        retry={retryUser}
        title="Account could not be loaded"
      />
    );
  }
  if (!account) return <SetupChecklistSkeleton />;

  if (state.appId === id && state.status === "in_progress") {
    return <ActiveSetup app={app} state={state} persist={persist} />;
  }
  if (state.appId === id) {
    return (
      <TerminalStatus
        completed={state.status === "completed"}
        onRestart={start}
      />
    );
  }
  return (
    <StartStatus
      otherInProgress={state.status === "in_progress"}
      onStart={start}
    />
  );
}

function ActiveSetup({
  app,
  state,
  persist,
}: {
  app: AppDetail;
  state: OnboardingState;
  persist: Persist;
}) {
  const competitors = useQuery(competitorsOptions(app.id));
  const collecting = useFirstRunDiscovery(app.id);
  const homeKeywords = useQuery(keywordsOptions(app.id, app.country));
  const suggestions = useQuery({
    ...marketSuggestionsOptions(app.id),
    retry: false,
  });
  const keywordQueries = useQueries({
    queries: state.selectedMarkets.map((market) =>
      keywordsOptions(app.id, market),
    ),
  });
  const countQueries: LiveQuery[] = [competitors, homeKeywords];
  const liveQueries = countQueries.concat(keywordQueries);
  const counts: SetupCounts = {
    competitors: lengthOrNull(competitors.data),
    keywords: activeCount(homeKeywords.data),
  };
  const keywordCounts = state.selectedMarkets.map((market, index) => ({
    market,
    active: activeCount(keywordQueries[index]?.data),
    error: keywordQueries[index]?.isError ?? false,
  }));
  const ready = liveQueries.every((query) => query.data !== undefined);
  const failed = liveQueries.some((query) => query.isError);
  const retry = () => {
    for (const query of liveQueries) {
      if (query.isError) void query.refetch();
    }
  };
  const step = (name: SetupStep) => ({
    state: stepState(state, name, counts),
    onSkip: (skipped: boolean) =>
      persist((current) => setStepSkipped(current, name, skipped)),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          Set up {app.name ?? "this app"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Three short steps. Each one is done once its number is reached, or
          skipped when it does not apply.
        </p>
      </div>
      <CompetitorsStep
        {...step("competitors")}
        appId={app.id}
        competitors={competitors.data ?? null}
        error={competitors.isError}
        collecting={collecting}
      />
      <KeywordsStep
        {...step("keywords")}
        appId={app.id}
        homeMarket={app.country}
        homeCount={counts.keywords}
        counts={keywordCounts}
      />
      <CountriesStep
        {...step("countries")}
        appId={app.id}
        homeMarket={app.country}
        markets={state.selectedMarkets}
        suggestions={suggestions.data ?? null}
        onSelect={(market, selected) =>
          persist((current) => setMarketSelected(current, market, selected))
        }
        onReviewed={() => persist(setCountriesReviewed)}
      />
      <SetupActions
        ready={ready}
        failed={failed}
        completable={ready && canCompleteOnboarding(state, counts)}
        onRetry={retry}
        onDismiss={() => persist(dismissOnboarding)}
        onComplete={() =>
          persist((current) => completeOnboarding(current, counts))
        }
      />
    </div>
  );
}

function SetupActions({
  ready,
  failed,
  completable,
  onRetry,
  onDismiss,
  onComplete,
}: {
  ready: boolean;
  failed: boolean;
  completable: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  onComplete: () => void;
}) {
  return (
    <>
      {!ready ? (
        <Alert role="status" className="items-center">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {failed
              ? "Some live counts could not be loaded."
              : "Finish loading every live count before completing setup."}
            {failed ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw />
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss setup
        </Button>
        <Button disabled={!completable} onClick={onComplete}>
          <CheckCircle2 />
          Complete setup
        </Button>
      </div>
    </>
  );
}

function StartStatus({
  otherInProgress,
  onStart,
}: {
  otherInProgress: boolean;
  onStart: () => void;
}) {
  return (
    <SetupStatus
      title={
        otherInProgress
          ? "Another setup is in progress"
          : "Start setup for this app"
      }
      description={
        otherInProgress
          ? "Switching will replace the unfinished setup of the other app."
          : "This checklist helps you reach a first set of positions. Nothing is changed until you add something."
      }
      action="Start this setup"
      onAction={onStart}
    />
  );
}

function TerminalStatus({
  completed,
  onRestart,
}: {
  completed: boolean;
  onRestart: () => void;
}) {
  return (
    <SetupStatus
      title={completed ? "Setup complete" : "Setup dismissed"}
      description={
        completed
          ? "Positions, competitors and countries are being collected."
          : "The checklist will not resume automatically. You can restart it whenever you need it."
      }
      action="Restart setup"
      onAction={onRestart}
    />
  );
}

function SetupStatus({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={onAction}>{action}</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to apps</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

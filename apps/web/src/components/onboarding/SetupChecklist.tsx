"use client";

import { Suspense, useMemo, useSyncExternalStore } from "react";
import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { AppDetail } from "@asobeast/shared";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { BudgetCardSkeleton } from "@/components/settings/skeletons";
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
  getOnboardingSnapshot,
  getServerOnboardingSnapshot,
  parseOnboardingState,
  restartOnboarding,
  saveOnboardingState,
  setMarketSelected,
  setOnboardingAcknowledgement,
  subscribeOnboarding,
  type OnboardingAcknowledgements,
  type OnboardingState,
} from "@/lib/onboarding";
import {
  appDetailOptions,
  budgetOptions,
  competitorsOptions,
  emailAlertsOptions,
  keywordsOptions,
  webhooksOptions,
} from "@/lib/queries";
import {
  AlertsStep,
  CompetitorsStep,
  KeywordsStep,
  MarketsStep,
  SetupCheckbox,
} from "./setup-steps";

type Transition = (current: OnboardingState) => OnboardingState;
type Persist = (transition: Transition) => void;
type LiveQuery = { data: unknown; isError: boolean; refetch: () => void };

const lengthOrZero = <T,>(value: T[] | undefined): number => value?.length ?? 0;
const lengthOrNull = <T,>(value: T[] | undefined): number | null =>
  value ? value.length : null;

function useBrowserOnboarding() {
  const snapshot = useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingSnapshot,
    getServerOnboardingSnapshot,
  );
  const state = useMemo(() => parseOnboardingState(snapshot), [snapshot]);
  const persist: Persist = (transition) => {
    saveOnboardingState(transition(state));
  };
  return { state, persist };
}

export function SetupChecklist({ id }: { id: string }) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { state, persist } = useBrowserOnboarding();
  const start = () => persist(() => restartOnboarding(id, app.country));

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
  const budget = useQuery(budgetOptions);
  const webhooks = useQuery(webhooksOptions);
  const emailAlerts = useQuery(emailAlertsOptions);
  const keywordQueries = useQueries({
    queries: state.selectedMarkets.map((market) =>
      keywordsOptions(app.id, undefined, market),
    ),
  });
  const channelQueries: LiveQuery[] = [
    competitors,
    budget,
    webhooks,
    emailAlerts,
  ];
  const liveQueries = channelQueries.concat(keywordQueries);
  const competitorCount = lengthOrZero(competitors.data);
  const alertCount =
    lengthOrZero(webhooks.data) + lengthOrZero(emailAlerts.data);
  const keywordCounts = state.selectedMarkets.map((market, index) => ({
    market,
    active:
      keywordQueries[index]?.data?.filter((keyword) => keyword.active).length ??
      null,
    error: keywordQueries[index]?.isError ?? false,
  }));
  const channelsLoaded =
    webhooks.data !== undefined && emailAlerts.data !== undefined;
  const ready = liveQueries.every((query) => query.data !== undefined);
  const failed = liveQueries.some((query) => query.isError);
  const retry = () => {
    for (const query of liveQueries) {
      if (query.isError) query.refetch();
    }
  };
  const completable =
    ready && canCompleteOnboarding(state, competitorCount, alertCount);
  const acknowledge = (
    key: keyof OnboardingAcknowledgements,
    checked: boolean,
  ) =>
    persist((current) => setOnboardingAcknowledgement(current, key, checked));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          Set up {app.name ?? "this app"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Work through five existing product areas. Progress stays in this
          browser.
        </p>
      </div>
      <MarketsStep
        appId={app.id}
        homeMarket={app.country}
        markets={state.selectedMarkets}
        onSelect={(market, selected) =>
          persist((current) => setMarketSelected(current, market, selected))
        }
      />
      <CompetitorsStep
        appId={app.id}
        count={lengthOrNull(competitors.data)}
        error={competitors.isError}
        acknowledged={state.acknowledgements.noCompetitors}
        onAcknowledge={(checked) => acknowledge("noCompetitors", checked)}
      />
      <KeywordsStep
        appId={app.id}
        homeMarket={app.country}
        counts={keywordCounts}
        confirmed={state.acknowledgements.keywordsConfirmed}
        onConfirm={(checked) => acknowledge("keywordsConfirmed", checked)}
      />
      <CapacityStep
        loaded={Boolean(budget.data)}
        error={budget.isError}
        checked={state.acknowledgements.capacityReviewed}
        onChange={(checked) => acknowledge("capacityReviewed", checked)}
      />
      <AlertsStep
        count={channelsLoaded ? alertCount : null}
        error={webhooks.isError || emailAlerts.isError}
        skipped={state.acknowledgements.alertsSkipped}
        onSkip={(checked) => acknowledge("alertsSkipped", checked)}
      />
      <SetupActions
        ready={ready}
        failed={failed}
        completable={completable}
        onRetry={retry}
        onDismiss={() => persist(dismissOnboarding)}
        onComplete={() =>
          persist((current) =>
            completeOnboarding(current, competitorCount, alertCount),
          )
        }
      />
    </div>
  );
}

function CapacityStep({
  loaded,
  error,
  checked,
  onChange,
}: {
  loaded: boolean;
  error: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Step 4 of 5</CardDescription>
          <CardTitle>Daily request budget unavailable</CardTitle>
          <CardDescription>
            Try again before confirming capacity.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!loaded) return <BudgetCardSkeleton />;
  return (
    <Suspense fallback={<BudgetCardSkeleton />}>
      <BudgetCard
        stepLabel="Step 4 of 5"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <SetupCheckbox
              id="setup-capacity-reviewed"
              checked={checked}
              onChange={onChange}
              label="I reviewed daily request capacity"
            />
            <Button asChild variant="outline">
              <Link href="/settings#daily-capacity">
                Open capacity settings
              </Link>
            </Button>
          </div>
        }
      />
    </Suspense>
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
          ? "Switching will replace the unfinished browser checklist for the other app."
          : "This opens a new browser-local checklist and does not change application data."
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
          ? "Markets, competitors, keywords, capacity and alerts have been reviewed."
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

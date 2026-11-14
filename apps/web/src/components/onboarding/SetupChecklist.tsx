"use client";

import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  canCompleteSetup,
  setupProgress,
  stepStates,
  type AppDetail,
  type AppSetupState,
  type SetupStep,
} from "@asobeast/shared";
import { GoalPicker } from "@/components/checklist/GoalPicker";
import {
  failedRead,
  InlineQueryError,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import { META_LINE } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { Separated } from "@/components/ui/separated";
import { Skeleton } from "@/components/ui/skeleton";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { cn } from "@/lib/utils";
import {
  appDetailOptions,
  keywordsOptions,
  marketSuggestionsOptions,
} from "@/lib/queries";
import { SetupActions } from "./SetupActions";
import {
  activeKeywordCount,
  completedFacts,
  completionHint,
} from "./setup-progress";
import { CompetitorsStep, CountriesStep, KeywordsStep } from "./setup-steps";
import { SetupProgress, SetupStepList, SetupStepNav } from "./SetupProgress";
import { SetupStatusPanel } from "./SetupStatusPanel";
import {
  beginSetup,
  completeSetup,
  dismissSetup,
  reviewCountries,
  selectMarket,
  skipStep,
  type SetupTransition,
} from "./setup-transitions";
import { useFirstRunDiscovery } from "./use-first-run-discovery";
import { useSetup } from "./use-setup";
import { useSetupCounts } from "./use-setup-counts";

type Apply = (transition: SetupTransition, onSaved?: () => void) => void;
type LiveQuery = { data: unknown; isError: boolean; refetch: () => unknown };

const COLUMN = "flex min-w-0 max-w-[45rem] flex-col gap-6";

const ACTIVE_GRID =
  "grid gap-6 [--rail-steps:--spacing(31)] @4xl/setup:grid-cols-[minmax(0,45rem)_15rem] @4xl/setup:gap-x-8";

const MAIN_CELL = "min-w-0 max-w-[45rem] @4xl/setup:col-start-1";

const RAIL_CELL =
  "@4xl/setup:sticky @4xl/setup:col-start-2 @4xl/setup:row-start-1 @4xl/setup:row-span-5 @4xl/setup:self-start";

const NOT_STARTED = { skipped: [], countriesReviewed: false };

const SETUP_VIEW_FOCUS_KEY = "setup.view";

const replacingView =
  (action: () => void): (() => void) =>
  () => {
    armFocusHandoff(SETUP_VIEW_FOCUS_KEY);
    action();
  };

export function SetupChecklist({ id }: { id: string }) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { setup, apply } = useSetup(id);
  const start = replacingView(() => apply(beginSetup(app.country)));

  if (setup.status === "in_progress") {
    return <ActiveSetup app={app} setup={setup} apply={apply} />;
  }
  return (
    <div className={COLUMN}>
      <GoalPicker />
      <StatusPanel app={app} setup={setup} onStart={start} />
    </div>
  );
}

function StatusPanel({
  app,
  setup,
  onStart,
}: {
  app: AppDetail;
  setup: AppSetupState;
  onStart: () => void;
}) {
  if (setup.status === "not_started") {
    return <StartStatus app={app} onStart={onStart} />;
  }
  if (setup.status === "completed") {
    return <CompletedStatus app={app} setup={setup} onRestart={onStart} />;
  }
  return (
    <SetupStatusPanel
      title="Setup dismissed"
      sentence="The checklist will not resume automatically. You can restart it whenever you need it."
      actions={
        <>
          <RestartButton onRestart={onStart} />
          <BackToApps />
        </>
      }
    />
  );
}

function retryAll(reads: RetryableRead[]): RetryableRead {
  return {
    data: undefined,
    isError: true,
    isFetching: reads.some((read) => read.isFetching),
    errorUpdatedAt: Math.max(...reads.map((read) => read.errorUpdatedAt)),
    refetch: () => Promise.all(reads.map((read) => read.refetch())),
  };
}

function RestartButton({ onRestart }: { onRestart: () => void }) {
  const claimFocus = useFocusClaim(SETUP_VIEW_FOCUS_KEY);
  return (
    <Button ref={claimFocus} onClick={onRestart}>
      Restart setup
    </Button>
  );
}

function BackToApps() {
  return (
    <Button asChild variant="outline">
      <Link href="/">Back to apps</Link>
    </Button>
  );
}

function ActiveSetup({
  app,
  setup,
  apply,
}: {
  app: AppDetail;
  setup: AppSetupState;
  apply: Apply;
}) {
  const router = useRouter();
  const claimFocus = useFocusClaim(SETUP_VIEW_FOCUS_KEY);
  const { competitors, homeKeywords, counts } = useSetupCounts(app);
  const collecting = useFirstRunDiscovery(app.id);
  const suggestions = useQuery({
    ...marketSuggestionsOptions(app.id),
    retry: false,
  });
  const keywordQueries = useQueries({
    queries: setup.selectedMarkets.map((market) =>
      keywordsOptions(app.id, market),
    ),
  });
  const countQueries: LiveQuery[] = [competitors, homeKeywords];
  const keywordCounts = setup.selectedMarkets.map((market, index) => {
    const keywords = keywordQueries[index]?.data;
    return {
      market,
      active: keywords ? activeKeywordCount(keywords) : null,
      error: keywordQueries[index]?.isError ?? false,
    };
  });
  const ready = countQueries.every((query) => query.data !== undefined);
  const states = stepStates(setup, counts);
  const progress = setupProgress(setup, counts);
  const step = (name: SetupStep) => ({
    state: states[name],
    onSkip: (skipped: boolean) => apply(skipStep(name, skipped)),
  });
  const actions = {
    ready,
    failed: countQueries.some((query) => query.isError),
    completable: ready && canCompleteSetup(setup, counts),
    hint: completionHint(states),
    onRetry: () => {
      for (const query of countQueries.concat(keywordQueries)) {
        if (query.isError) void query.refetch();
      }
    },
    onDismiss: replacingView(() => apply(dismissSetup())),
    onComplete: replacingView(() =>
      apply(completeSetup(), () => router.push(`/apps/${app.id}`)),
    ),
  };

  return (
    <div className="@container/setup">
      <div className={ACTIVE_GRID}>
        <div className={cn(MAIN_CELL, "empty:hidden")}>
          <GoalPicker />
        </div>
        <div className={MAIN_CELL}>
          <SetupProgress
            name={app.name}
            progress={progress}
            headingRef={claimFocus}
          />
        </div>
        <SetupStepNav
          states={states}
          next={progress.next}
          className={cn(RAIL_CELL, "-mt-3 @4xl/setup:top-20 @4xl/setup:mt-0")}
        />
        <div className={MAIN_CELL}>
          <CompetitorsStep
            {...step("competitors")}
            appId={app.id}
            competitors={competitors.data ?? null}
            error={competitors.isError}
            collecting={collecting}
          />
        </div>
        <div className={MAIN_CELL}>
          <KeywordsStep
            {...step("keywords")}
            appId={app.id}
            store={app.store}
            homeMarket={app.country}
            tracked={homeKeywords.data ?? null}
            error={homeKeywords.isError}
          />
        </div>
        <div className={MAIN_CELL}>
          <CountriesStep
            {...step("countries")}
            appId={app.id}
            store={app.store}
            homeMarket={app.country}
            counts={keywordCounts}
            suggestions={suggestions.data ?? null}
            onSelect={(market, selected) =>
              apply(selectMarket(market, selected))
            }
            onReviewed={() => apply(reviewCountries())}
          />
        </div>
        <SetupActions
          {...actions}
          className={cn(
            RAIL_CELL,
            "max-w-[45rem] border-t pt-6 @4xl/setup:top-[calc(--spacing(20)+var(--rail-steps))] @4xl/setup:mt-(--rail-steps) @4xl/setup:pt-4",
          )}
        />
      </div>
    </div>
  );
}

function StartStatus({
  app,
  onStart,
}: {
  app: AppDetail;
  onStart: () => void;
}) {
  const { counts } = useSetupCounts(app);
  return (
    <SetupStatusPanel
      title="Start setup for this app"
      sentence="Three short steps to a first set of positions. Each one is done once its number is reached, or skipped when it does not apply. Nothing is changed until you add something."
      actions={
        <>
          <Button onClick={onStart}>Start this setup</Button>
          <BackToApps />
        </>
      }
    >
      <SetupStepList
        states={stepStates(NOT_STARTED, counts)}
        next={null}
        layout="stacked"
        className="max-w-64"
      />
    </SetupStatusPanel>
  );
}

function CompletedStatus({
  app,
  setup,
  onRestart,
}: {
  app: AppDetail;
  setup: AppSetupState;
  onRestart: () => void;
}) {
  const claimFocus = useFocusClaim(SETUP_VIEW_FOCUS_KEY);
  const { competitors, homeKeywords, counts } = useSetupCounts(app);
  const countReads = [competitors, homeKeywords];
  const failed = countReads.filter(failedRead);
  const loading = countReads.some(
    (read) => read.data === undefined && !failedRead(read),
  );
  return (
    <SetupStatusPanel
      title="Setup complete"
      sentence="Positions, competitors and countries are collected on every daily run."
      actions={
        <>
          <Button ref={claimFocus} asChild>
            <Link href={`/apps/${app.id}`}>Open the overview</Link>
          </Button>
          <Button variant="outline" onClick={onRestart}>
            Restart setup
          </Button>
        </>
      }
    >
      {loading ? (
        <Skeleton className="h-5 w-72 max-w-full" />
      ) : (
        <p className={META_LINE}>
          <Separated
            parts={completedFacts({
              ...counts,
              home: app.country,
              markets: setup.selectedMarkets.length,
              completedAt: setup.completedAt,
            })}
          />
        </p>
      )}
      {failed.length > 0 ? (
        <InlineQueryError
          message="Some setup counts could not be loaded."
          read={retryAll(failed)}
        />
      ) : null}
    </SetupStatusPanel>
  );
}

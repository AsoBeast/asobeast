import {
  formatCheckedPosition,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChecking, lostPosition, staleCheckDay } from "@/lib/keyword-checks";
import { dayChange } from "@/lib/keyword-day-change";
import {
  INSIGHT_LABELS,
  insightDetail,
  insightsOf,
} from "@/lib/keyword-insights";
import { shownScore } from "@/lib/keyword-scores";
import { DayChangeCell } from "../DayChangeCell";
import { INSIGHT_VARIANTS } from "../InsightsCell";
import { CheckingMark } from "../keyword-cells";
import { KeywordAnnotationsDialog } from "../KeywordAnnotationsDialog";
import { StaleCheckMark } from "../StaleCheckMark";
import { PositionReadout } from "../PositionReadout";
import {
  DerivedScoreDetails,
  ScoreDetails,
  ScoreReadout,
} from "../score-cells";
import {
  difficultyEvidence,
  opportunityEvidence,
  popularityEvidence,
} from "../score-evidence";
import { SheetSection } from "./SheetSection";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-label text-faint-foreground">{label}</dt>
      <dd className="flex min-h-8 items-center gap-2">{children}</dd>
    </div>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function UncheckedPosition({ checking }: { checking: boolean }) {
  return checking ? (
    <CheckingMark />
  ) : (
    <Missing label="Position: not checked yet" />
  );
}

function ScoreFact({
  label,
  metric,
  value,
  emphasize,
  outdated,
  floorAnswer,
}: {
  label: string;
  metric: "opportunity" | "popularity" | "difficulty";
  value: number | null;
  emphasize?: boolean;
  outdated?: boolean;
  floorAnswer?: boolean;
}) {
  const shown = shownScore(value);
  return (
    <Fact label={label}>
      {shown === null ? (
        <Missing label={`${label}: not scored yet`} />
      ) : (
        <ScoreReadout
          value={shown}
          label={label}
          metric={metric}
          emphasize={emphasize}
          outdated={outdated}
          floorAnswer={floorAnswer}
          className="ml-0 items-start"
        />
      )}
    </Fact>
  );
}

export function KeywordSheetFacts({
  keyword,
  today,
}: {
  keyword: TrackedKeywordItem;
  today: string;
}) {
  const label = formatCheckedPosition(
    keyword.latestPosition,
    keyword.latestDepth,
  );
  const staleOn = staleCheckDay(keyword, today);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pt-4 pb-4 sm:grid-cols-4">
      <Fact label="Position">
        {label === null ? (
          <UncheckedPosition checking={isChecking(keyword)} />
        ) : (
          <>
            <PositionReadout
              keyword={keyword}
              label={label}
              staleOn={staleOn}
              lost={lostPosition(keyword)}
              chip
            />
            {staleOn === null ? null : <StaleCheckMark day={staleOn} />}
            <DayChangeCell
              change={dayChange(keyword, today)}
              muted={!keyword.active}
            />
          </>
        )}
      </Fact>
      {[
        opportunityEvidence(keyword),
        popularityEvidence(keyword),
        difficultyEvidence(keyword),
      ].map((evidence) => (
        <ScoreFact
          key={evidence.metric}
          label={evidence.label}
          metric={evidence.metric}
          value={evidence.value}
          emphasize={evidence.metric === "opportunity"}
          outdated={"outdated" in evidence && evidence.outdated}
          floorAnswer={"floorAnswer" in evidence && evidence.floorAnswer}
        />
      ))}
    </dl>
  );
}

export function KeywordSheetInsights({
  keyword,
  today,
}: {
  keyword: TrackedKeywordItem;
  today: string;
}) {
  const insights = insightsOf(keyword, today);
  if (keyword.active && insights.length === 0) return null;
  return (
    <SheetSection title="What to know">
      {keyword.active ? null : (
        <p className="text-muted-foreground">
          Tracking is paused, so this keyword is no longer checked. Resume it
          from the keyword actions menu.
        </p>
      )}
      {insights.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {insights.map((insight) => (
            <li key={insight} className="flex flex-wrap items-center gap-2">
              <Badge variant={INSIGHT_VARIANTS[insight]}>
                {INSIGHT_LABELS[insight]}
              </Badge>
              <span className="text-muted-foreground">
                {insightDetail(keyword, insight)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  );
}

const EVIDENCE = "flex flex-col gap-1 text-dense text-muted-foreground";

function EvidenceRow({
  label,
  value,
  children,
}: {
  label: string;
  value: number | null;
  children: ReactNode;
}) {
  const shown = shownScore(value);
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2">
        <span className="font-medium">{label}</span>
        {shown === null ? (
          <span className="text-muted-foreground">not scored yet</span>
        ) : null}
      </p>
      {shown === null ? null : <div className={EVIDENCE}>{children}</div>}
    </div>
  );
}

export function KeywordSheetScores({
  keyword,
}: {
  keyword: TrackedKeywordItem;
}) {
  const opportunity = opportunityEvidence(keyword);
  const popularity = popularityEvidence(keyword);
  const difficulty = difficultyEvidence(keyword);
  return (
    <SheetSection title="Scores and where they come from">
      <EvidenceRow label={opportunity.label} value={opportunity.value}>
        <DerivedScoreDetails details={opportunity.details} />
      </EvidenceRow>
      <EvidenceRow label={popularity.label} value={popularity.value}>
        <ScoreDetails {...popularity} />
      </EvidenceRow>
      <EvidenceRow label={difficulty.label} value={difficulty.value}>
        <ScoreDetails {...difficulty} />
      </EvidenceRow>
    </SheetSection>
  );
}

export function KeywordSheetNotes({
  appId,
  keyword,
  marketTags,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  marketTags: () => string[];
}) {
  const [editing, setEditing] = useState(false);
  const edit = useRef<HTMLButtonElement>(null);
  const tags = keyword.tags ?? [];
  return (
    <SheetSection title="Tags and note">
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-sm border px-1.5 text-label text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      {keyword.note ? (
        <p dir="auto" className="wrap-anywhere text-muted-foreground">
          {keyword.note}
        </p>
      ) : null}
      {tags.length === 0 && !keyword.note ? (
        <p className="text-muted-foreground">No tags or note yet.</p>
      ) : null}
      <div>
        <Button
          ref={edit}
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit tags and note
        </Button>
      </div>
      <KeywordAnnotationsDialog
        open={editing}
        onOpenChange={setEditing}
        appId={appId}
        keyword={keyword}
        marketTags={marketTags}
        returnFocus={edit}
      />
    </SheetSection>
  );
}

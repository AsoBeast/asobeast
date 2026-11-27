"use client";

import {
  formatCheckedPosition,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChecking, lostPosition, staleCheckDay } from "@/lib/keyword-checks";
import { dayChange } from "@/lib/keyword-day-change";
import {
  insightDetail,
  insightLabel,
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
import { SheetSection } from "@/components/layout/SheetSection";

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
  const t = useTranslations("keywordInspector");
  return checking ? (
    <CheckingMark />
  ) : (
    <Missing label={t("keywordSheet.facts.notChecked")} />
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
  const t = useTranslations("keywordInspector");
  const shown = shownScore(value);
  return (
    <Fact label={label}>
      {shown === null ? (
        <Missing label={t("keywordSheet.facts.notScored", { label })} />
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
    keyword.latestResultCount,
  );
  const t = useTranslations("keywords");
  const staleOn = staleCheckDay(keyword, today);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pt-4 pb-4 sm:grid-cols-4">
      <Fact label={t("table.position")}>
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
        opportunityEvidence(keyword, t),
        popularityEvidence(keyword, t),
        difficultyEvidence(keyword, t),
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
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  if (keyword.active && insights.length === 0) return null;
  return (
    <SheetSection title={t("keywordSheet.insights.title")}>
      {keyword.active ? null : (
        <p className="text-muted-foreground">
          {t("keywordSheet.insights.paused")}
        </p>
      )}
      {insights.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {insights.map((insight) => (
            <li key={insight} className="flex flex-wrap items-center gap-2">
              <Badge variant={INSIGHT_VARIANTS[insight]}>
                {insightLabel(insight, keywords)}
              </Badge>
              <span className="text-muted-foreground">
                {insightDetail(keyword, insight, keywords)}
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
  const t = useTranslations("keywordInspector");
  const shown = shownScore(value);
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2">
        <span className="font-medium">{label}</span>
        {shown === null ? (
          <span className="text-muted-foreground">
            {t("keywordSheet.scores.notScored")}
          </span>
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
  const t = useTranslations("keywords");
  const copy = useTranslations("keywordInspector");
  const opportunity = opportunityEvidence(keyword, t);
  const popularity = popularityEvidence(keyword, t);
  const difficulty = difficultyEvidence(keyword, t);
  return (
    <SheetSection title={copy("keywordSheet.scores.title")}>
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
  const t = useTranslations("keywordInspector");
  const edit = useRef<HTMLButtonElement>(null);
  const tags = keyword.tags ?? [];
  return (
    <SheetSection title={t("keywordSheet.notes.title")}>
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
        <p className="text-muted-foreground">{t("keywordSheet.notes.empty")}</p>
      ) : null}
      <div>
        <Button
          ref={edit}
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          {t("keywordSheet.notes.edit")}
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

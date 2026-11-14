"use client";

import { Suspense, useId } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  AppAuditResult,
  AuditCheckStatus,
  AuditGroupId,
} from "@asobeast/shared";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { RangePicker } from "@/components/rankings/RangePicker";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import { Meter, type MeterTone } from "@/components/ui/meter";
import { ScoreRing } from "@/components/ui/score-ring";
import { auditHistoryOptions } from "@/lib/queries";
import { presetToRange, VISIBILITY_RANGES } from "@/lib/ranges";
import { cn } from "@/lib/utils";
import {
  gradeLabel,
  GROUP_LABEL,
  measuredLine,
  percent,
  potentialLine,
  provisional,
  scoredFactorsLine,
  scoreRingLabel,
  scoreStatus,
  STATUS_LABEL,
} from "./audit-copy";
import { unlockHref } from "./audit-links";
import { AuditHealthChart } from "./AuditHealthChart";
import { TEXT_LINK } from "./layout-classes";
import { CHANGE_WINDOW_DAYS, weekChange } from "./score-history";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";
import { useAuditRange } from "./use-audit-range";

const CELL = "bg-card shadow-[-1px_0_0_var(--border),0_-1px_0_var(--border)]";

const CHANGE_LABEL = `${CHANGE_WINDOW_DAYS}d`;

function WeekChange({ audit }: { audit: AppAuditResult }) {
  const { shownRange } = useAuditRange();
  const { data } = useSuspenseQuery(
    auditHistoryOptions(audit.appId, presetToRange(shownRange)),
  );
  const change = weekChange(data.points, audit);
  return change === null ? null : (
    <TrendChip label={CHANGE_LABEL} value={change} form="pill" />
  );
}

function MeasuredLine({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined) return null;
  if (!provisional(confidence)) return <p>{measuredLine(confidence)}</p>;
  return (
    <p>
      <span className="font-medium text-warning">Provisional</span>
      <span>{` · ${percent(confidence)}% measured`}</span>
    </p>
  );
}

function ScoreSummary({ audit }: { audit: AppAuditResult }) {
  const headingId = useId();
  const { overall, grade, confidence, potential } = audit;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(CELL, "flex items-center gap-4 p-4")}
    >
      <ScoreRing
        value={overall}
        label={scoreRingLabel(overall, grade, confidence)}
      >
        <span className="numeric text-5xl font-semibold tracking-tight">
          {overall === null ? "—" : Math.round(overall)}
        </span>
      </ScoreRing>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id={headingId} className="text-label text-muted-foreground">
          ASO score
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="numeric text-title">{grade ?? "—"}</span>
          <span className="text-body text-muted-foreground">
            {gradeLabel(grade)}
          </span>
          <Suspense fallback={null}>
            <WeekChange audit={audit} />
          </Suspense>
        </p>
        <div className="flex flex-col gap-0.5 text-caption text-faint-foreground">
          <MeasuredLine confidence={confidence} />
          {potential !== null && potential !== undefined ? (
            <p>{potentialLine(potential)}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FigureStatus({ status }: { status: AuditCheckStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <>
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", STATUS_TONE[status])}
      />
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </>
  );
}

function FigureTile({
  label,
  value,
  share,
  tone,
  status,
  note,
}: {
  label: string;
  value: string;
  share: number;
  tone: MeterTone;
  status?: AuditCheckStatus;
  note: string;
}) {
  return (
    <div
      className={cn(
        CELL,
        "row-span-4 grid grid-rows-subgrid gap-y-1.5 px-3 py-4 sm:px-4",
      )}
    >
      <span className="self-end text-label text-balance text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="numeric text-metric">{value}</span>
        {status ? <FigureStatus status={status} /> : null}
      </span>
      <Meter value={share} max={1} tone={tone} className="h-1.5" />
      <span className="self-start text-caption text-balance text-faint-foreground">
        {note}
      </span>
    </div>
  );
}

function groupNote(audit: AppAuditResult, group: AuditGroupId): string {
  const factors = audit.factors.filter(
    (factor) =>
      factor.group === group && factor.availability !== "not-measurable",
  );
  return scoredFactorsLine(
    factors.filter((factor) => factor.score !== null).length,
    factors.length,
  );
}

function ScoreFigures({ audit }: { audit: AppAuditResult }) {
  const { groups = [], confidence } = audit;
  return (
    <div className="@container/score">
      <div className="grid overflow-hidden @[40rem]/score:grid-cols-[minmax(20rem,7fr)_minmax(0,9fr)]">
        <ScoreSummary audit={audit} />
        <div className="grid auto-cols-fr grid-flow-col grid-rows-[1fr_auto_auto_1fr]">
          {groups.map((group) => (
            <FigureTile
              key={group.id}
              label={GROUP_LABEL[group.id]}
              value={
                group.score === null
                  ? "—"
                  : String(Math.round(group.score * 10))
              }
              share={(group.score ?? 0) / 10}
              tone="health"
              status={scoreStatus(group.score)}
              note={groupNote(audit, group.id)}
            />
          ))}
          {confidence === undefined ? null : (
            <FigureTile
              label="Measured"
              value={`${percent(confidence)}%`}
              share={confidence}
              tone="neutral"
              note="of the rubric"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Unlocks({ audit }: { audit: AppAuditResult }) {
  const { unlocks = [] } = audit;
  if (unlocks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 text-caption text-faint-foreground">
      <span>Score more of the rubric:</span>
      <ul className="contents">
        {unlocks.map((unlock) => (
          <li key={unlock.kind} className="contents">
            <Link
              href={unlockHref(audit.appId, unlock.kind)}
              className={TEXT_LINK}
            >
              {unlock.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditScorePanel({ audit }: { audit: AppAuditResult }) {
  const { range, shownRange, setRange } = useAuditRange();

  return (
    <Card className="gap-0 py-0">
      <ScoreFigures audit={audit} />
      <Unlocks audit={audit} />
      <CardContent
        aria-busy={shownRange !== range || undefined}
        className="flex flex-col gap-2 border-t border-border pt-3 pb-4"
      >
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-heading">Score history</h2>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </div>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
          <AuditHealthChart
            id={audit.appId}
            range={shownRange}
            potential={audit.potential ?? null}
          />
        </Suspense>
      </CardContent>
      <CardFooter>
        <span>
          One snapshot a day. A rubric change can move the score without a
          listing change.
        </span>
      </CardFooter>
    </Card>
  );
}

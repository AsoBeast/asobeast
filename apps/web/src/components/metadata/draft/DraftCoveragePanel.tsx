"use client";

import { useId } from "react";
import type { CoveragePreviewResult } from "@asobeast/shared";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { LIST_HEAD, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { formatCountry, formatList } from "@/lib/format";
import { marketNote, previewGroups, wasteReason } from "@/lib/listing-draft";
import { coverageVerdict } from "./coverage-verdict";
import { DraftKeywordList } from "./DraftKeywordList";
import { DraftTargetList } from "./DraftTargetList";
import { DRAFT_COVERAGE_ID, VerdictFigures } from "./DraftVerdict";
import type { CoveragePreview } from "./use-coverage-preview";

const MISSING_SHOWN = 8;

function CoverageTip() {
  return (
    <InfoTip
      label="About draft coverage"
      title="How a draft is judged"
      summary="Each tracked keyword is judged against the draft with the same rules as Keyword coverage, so a draft that ships reads the same in the table on the next capture."
    >
      <a
        href="https://docs.asobeast.com/guides/metadata-workbench#check-keyword-coverage"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read how coverage is judged
      </a>
    </InfoTip>
  );
}

function WastedWords({ result }: { result: CoveragePreviewResult }) {
  const headingId = useId();
  if (result.wastedWords.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle px-2 pt-3">
      <h3 id={headingId} className={LIST_HEAD}>
        <span className="text-foreground">Wasted words</span>
      </h3>
      <ul aria-labelledby={headingId} className="flex list-none flex-col p-0">
        {result.wastedWords.map((wasted) => (
          <li
            key={wasted.word}
            className="flex min-h-9 items-center justify-between gap-3 text-dense"
          >
            <span translate="no" dir="auto" className="truncate font-medium">
              {wasted.word}
            </span>
            <span className="shrink-0 text-caption text-faint-foreground">
              {wasteReason(wasted)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerdictLine({ result }: { result: CoveragePreviewResult }) {
  const verdict = coverageVerdict(result);
  if (!verdict) return null;
  return (
    <p
      role="status"
      className="flex flex-wrap items-baseline gap-x-2 px-2 text-body"
    >
      <VerdictFigures verdict={verdict} />
    </p>
  );
}

function PreviewBody({ result }: { result: CoveragePreviewResult }) {
  const { groups, showCountry } = previewGroups(result);
  const note = marketNote(result);
  return (
    <>
      {result.markets.length > 0 ? <VerdictLine result={result} /> : null}
      {result.targets ? <DraftTargetList targets={result.targets} /> : null}
      {note ? (
        <p className="px-2 text-dense text-muted-foreground">{note}</p>
      ) : null}
      <DraftKeywordList
        title="No longer covered"
        rows={groups.lost}
        shown={Infinity}
        showCountry={showCountry}
        tone="down"
      />
      <DraftKeywordList
        title="Newly covered"
        rows={groups.gained}
        shown={Infinity}
        showCountry={showCountry}
        tone="up"
      />
      <DraftKeywordList
        title="Still not covered"
        rows={groups.missing}
        shown={MISSING_SHOWN}
        showCountry={showCountry}
      />
      <DraftKeywordList
        title="Still covered"
        rows={groups.kept}
        shown={0}
        showCountry={showCountry}
      />
      <WastedWords result={result} />
    </>
  );
}

function Note({ children }: { children: string }) {
  return <p className="px-2 text-dense text-muted-foreground">{children}</p>;
}

function PanelState({
  preview,
  result,
}: {
  preview: CoveragePreview;
  result: CoveragePreviewResult | undefined;
}) {
  if (!preview.requested) {
    return <Note>Change a field to see what it would cover.</Note>;
  }
  if (result) return <PreviewBody result={result} />;
  if (preview.query.isError) {
    return (
      <div className="px-2">
        <InlineQueryError
          message="Could not load what this draft covers."
          read={preview.query}
        />
      </div>
    );
  }
  return <Note>Reading what this draft covers…</Note>;
}

function judgedIn(result: CoveragePreviewResult | undefined): string | null {
  if (!result || result.markets.length === 0) return null;
  return `Judged against the keywords you track in ${formatList(result.markets.map(formatCountry))}. Screenshot captions are not counted.`;
}

export function DraftCoveragePanel({ preview }: { preview: CoveragePreview }) {
  const headingId = useId();
  const { query, requested, settling } = preview;
  const result = requested && !query.isError ? query.data : undefined;
  const busy = requested && (settling || query.isFetching);
  const footer = judgedIn(result);

  return (
    <section
      id={DRAFT_COVERAGE_ID}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-28 outline-none"
    >
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Draft coverage</h2>
          </CardTitle>
          <CardAction>
            <CoverageTip />
          </CardAction>
        </CardHeader>
        <CardContent
          aria-busy={busy || undefined}
          className="flex flex-col gap-3 px-2"
        >
          <PanelState preview={preview} result={result} />
        </CardContent>
        {footer ? (
          <CardFooter>
            <span>{footer}</span>
          </CardFooter>
        ) : null}
      </Card>
    </section>
  );
}

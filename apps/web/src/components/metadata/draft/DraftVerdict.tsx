import { DeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { formatNumber } from "@/lib/format";
import { grade } from "@/lib/grade";
import {
  coverageShare,
  verdictSentence,
  type CoverageVerdictFigures,
} from "./coverage-verdict";

export const DRAFT_COVERAGE_ID = "draft-coverage";

export const changedFieldsLine = (count: number) =>
  `${formatNumber(count)} ${count === 1 ? "field" : "fields"} changed`;

export function VerdictFigures({
  verdict,
}: {
  verdict: CoverageVerdictFigures;
}) {
  const change = verdict.draft - verdict.live;
  return (
    <>
      <span>Covers</span>
      <GradedNumber
        value={`${formatNumber(verdict.draft)} of ${formatNumber(verdict.total)}`}
        grade={grade("coverage", coverageShare(verdict))}
        label="The draft covers"
        className="font-medium"
      />
      <span>tracked keywords</span>
      {change === 0 ? null : (
        <DeltaChip
          value={change}
          polarity="higher-is-better"
          period={`from the ${formatNumber(verdict.live)} the live listing covers`}
          className="self-center text-label"
        />
      )}
    </>
  );
}

export function DraftVerdictStrip({
  verdict,
}: {
  verdict: CoverageVerdictFigures | null;
}) {
  if (!verdict) return null;
  return (
    <a
      href={`#${DRAFT_COVERAGE_ID}`}
      aria-label={`${verdictSentence(verdict)} Go to Draft coverage`}
      className="sticky top-[60px] z-20 col-span-12 flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-lg border border-border bg-popover px-3 py-2 text-dense shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring @4xl/metadata:hidden print:hidden"
    >
      <VerdictFigures verdict={verdict} />
    </a>
  );
}

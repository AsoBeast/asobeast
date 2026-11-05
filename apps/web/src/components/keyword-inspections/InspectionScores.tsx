import type { KeywordInspection } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import {
  SCORING_CONFIDENCE_LABELS,
  SCORING_SOURCE_LABELS,
} from "@/components/keywords/score-cells";
import {
  difficultySignalLines,
  popularitySignalLines,
} from "@/components/keywords/score-signals";
import { competitionFacts, shownScore } from "./inspection-format";

function SignalNote({ lines }: { lines: string[] }) {
  return lines.length === 0 ? null : (
    <span className="text-xs text-muted-foreground">{lines.join(" ")}</span>
  );
}

export function InspectionScores({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  const { provenance, signals } = inspection;
  return (
    <section aria-label="Scores" className="flex flex-col gap-3">
      <StatTileGroup>
        <StatTile
          label="Popularity"
          value={shownScore(inspection.volume)}
          note={
            <SignalNote
              lines={popularitySignalLines(
                signals,
                provenance?.source,
                inspection.volume,
              )}
            />
          }
        />
        <StatTile
          label="Difficulty"
          value={shownScore(inspection.difficulty100)}
          note={<SignalNote lines={difficultySignalLines(signals)} />}
        />
        <StatTile
          label="Opportunity"
          value={shownScore(inspection.opportunity)}
          note={
            <span className="text-xs text-muted-foreground">
              High popularity against low difficulty, before any app is
              considered.
            </span>
          }
        />
      </StatTileGroup>
      {provenance ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{SCORING_SOURCE_LABELS[provenance.source]}</span>
          <span>Formula {provenance.formulaVersion}</span>
          <Badge variant="secondary">
            {SCORING_CONFIDENCE_LABELS[provenance.confidence]} confidence
          </Badge>
        </p>
      ) : null}
    </section>
  );
}

export function InspectionCompetition({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  if (!inspection.competition) return null;
  return (
    <section
      aria-labelledby="inspection-competition"
      className="flex flex-col gap-3"
    >
      <h3 id="inspection-competition" className="text-body font-semibold">
        Competition in the top {inspection.competition.topCount}
      </h3>
      <StatTileGroup>
        {competitionFacts(inspection.competition).map((fact) => (
          <StatTile
            key={fact.label}
            label={fact.label}
            value={fact.value}
            note={
              <span className="text-xs text-muted-foreground">{fact.note}</span>
            }
          />
        ))}
      </StatTileGroup>
    </section>
  );
}

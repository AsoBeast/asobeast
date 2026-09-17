import Link from "next/link";
import type { AppAuditResult } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatTile } from "@/components/ui/stat-tile";
import {
  gradeLabel,
  GROUP_LABEL,
  measuredLine,
  potentialLine,
  provisional,
  provisionalLine,
  scoreRingLabel,
} from "./audit-copy";
import { unlockHref } from "./audit-links";

export function AuditScoreHero({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const { overall, grade, confidence, potential, groups, unlocks } = audit;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <section aria-labelledby="aso-score-heading" className="contents">
          <h2 id="aso-score-heading" className="sr-only">
            ASO score
          </h2>
          <div className="flex items-center gap-4">
            <ScoreRing
              value={overall}
              label={scoreRingLabel(overall, grade, confidence)}
            >
              <span className="numeric font-mono text-4xl font-semibold">
                {overall === null ? "—" : Math.round(overall)}
              </span>
            </ScoreRing>
            <div className="flex flex-col gap-1">
              <span className="numeric font-mono text-2xl font-semibold">
                {grade ?? "—"}
              </span>
              <span className="text-body text-muted-foreground">
                {gradeLabel(grade)}
              </span>
              {provisional(confidence) ? (
                <Badge variant="warning">{provisionalLine(confidence)}</Badge>
              ) : null}
            </div>
          </div>

          {groups && groups.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {groups.map((group) => (
                <StatTile
                  key={group.id}
                  label={GROUP_LABEL[group.id]}
                  value={
                    group.score === null
                      ? "—"
                      : String(Math.round(group.score * 10))
                  }
                />
              ))}
            </div>
          ) : null}

          <p className="text-body text-muted-foreground">
            {measuredLine(confidence)}
          </p>
          {potential !== null && potential !== undefined ? (
            <p className="text-body text-muted-foreground">
              {potentialLine(potential)}
            </p>
          ) : null}

          {unlocks && unlocks.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {unlocks.map((unlock) => (
                <li key={unlock.kind}>
                  <Link href={unlockHref(appId, unlock.kind)}>
                    <Badge variant="outline">{unlock.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { ChangeImpactWindow } from "@asobeast/shared";
import { DeltaChip } from "@/components/ui/delta-chip";
import {
  measuredLine,
  movementLine,
  overlapNotice,
  rankingShiftLine,
  visibilityRange,
  windowStatusLine,
  windowTitle,
} from "./change-impact-copy";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label text-muted-foreground uppercase">{label}</dt>
      {children}
    </div>
  );
}

function MeasuredFacts({ impact }: { impact: ChangeImpactWindow }) {
  const range = visibilityRange(impact);
  if (impact.movement === null || range === null) return null;
  const shift = rankingShiftLine(impact.movement);

  return (
    <dl className="flex flex-col gap-2 text-body">
      <Fact label="Visibility">
        <dd className="flex items-center gap-2">
          <span className="numeric font-mono">{range}</span>
          <DeltaChip
            value={impact.visibilityChange}
            polarity="higher-is-better"
            period="in visibility"
          />
        </dd>
      </Fact>
      <Fact label="Keywords">
        <dd>{movementLine(impact.movement)}</dd>
        {shift ? <dd>{shift}</dd> : null}
        <dd className="text-caption text-muted-foreground">
          {measuredLine(impact.movement)}
        </dd>
      </Fact>
      <Fact label="Median position">
        <dd>
          {impact.medianPositionChange === null ? (
            <span className="text-muted-foreground">
              No keyword ranked on both days
            </span>
          ) : (
            <DeltaChip value={impact.medianPositionChange} period="positions" />
          )}
        </dd>
      </Fact>
    </dl>
  );
}

export function ChangeImpactWindowTile({
  impact,
}: {
  impact: ChangeImpactWindow;
}) {
  const notice = overlapNotice(impact.overlappingChanges);

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <h4 className="text-body font-medium">{windowTitle(impact.days)}</h4>
      <p className="text-caption text-muted-foreground">
        {windowStatusLine(impact)}
      </p>
      <MeasuredFacts impact={impact} />
      {notice ? (
        <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <TriangleAlert
            aria-hidden
            className="mt-0.5 size-3.5 shrink-0 text-warning"
          />
          {notice}
        </p>
      ) : null}
    </li>
  );
}

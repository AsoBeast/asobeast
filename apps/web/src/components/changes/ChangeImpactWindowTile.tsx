import type { ChangeImpactWindow, Store } from "@asobeast/shared";
import { DeltaChip } from "@/components/ui/delta-chip";
import { FUNNEL_GETS_LABEL } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import {
  funnelNote,
  funnelRanges,
  measuredLine,
  movementLine,
  overlapNotice,
  rankingShiftLine,
  visibilityRange,
  windowStatusLine,
  windowTitle,
} from "./change-impact-copy";
import { ImpactMovementBar } from "./ImpactMovementBar";

const FACTS =
  "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-dense";
const FACT_LABEL = "text-caption text-faint-foreground";
const FACT_VALUE = "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1";
const NOTE = "text-caption text-faint-foreground";

const COLUMN_START: Record<number, string> = {
  7: "@3xl/impact:col-start-1",
  14: "@3xl/impact:col-start-2",
  28: "@3xl/impact:col-start-3",
};

function MeasuredFacts({ impact }: { impact: ChangeImpactWindow }) {
  const range = visibilityRange(impact);
  if (impact.movement === null || range === null) return null;
  const shift = rankingShiftLine(impact.movement);
  const moved = movementLine(impact.movement);

  return (
    <dl className={FACTS}>
      <dt className={FACT_LABEL}>Visibility</dt>
      <dd className={FACT_VALUE}>
        <span className="numeric">{range}</span>
        <DeltaChip
          value={impact.visibilityChange}
          polarity="higher-is-better"
          period="in visibility"
          form="pill"
        />
      </dd>
      <dt className={FACT_LABEL}>Keywords</dt>
      <dd className={FACT_VALUE}>
        <ImpactMovementBar movement={impact.movement} />
      </dd>
      <dd className="col-span-2 -mt-0.5">
        {shift ? `${moved} · ${shift}` : moved}
      </dd>
      <dt className={FACT_LABEL}>Median position</dt>
      <dd className={FACT_VALUE}>
        {impact.medianPositionChange === null ? (
          <span className="text-muted-foreground">
            No keyword ranked on both days
          </span>
        ) : (
          <DeltaChip
            value={impact.medianPositionChange}
            period="positions"
            form="pill"
          />
        )}
      </dd>
    </dl>
  );
}

interface WindowProps {
  impact: ChangeImpactWindow;
  store: Store;
}

function FunnelFacts({ impact, store }: WindowProps) {
  const ranges = funnelRanges(impact.funnel);
  const note = funnelNote(impact.funnel, impact.days);
  if (!ranges) return note ? <p className={NOTE}>{note}</p> : null;
  const gets = impact.funnel?.change?.gets ?? null;
  const getsLabel = FUNNEL_GETS_LABEL[store];

  return (
    <dl className={FACTS}>
      <dt className={FACT_LABEL}>{getsLabel}</dt>
      <dd className={FACT_VALUE}>
        <span className="numeric">{ranges.gets}</span>
        <DeltaChip
          value={gets === null ? null : Math.round(gets * 100)}
          polarity="higher-is-better"
          period={`in ${getsLabel}`}
          unit="%"
          form="pill"
        />
      </dd>
      <dt className={FACT_LABEL}>Conversion</dt>
      <dd className={FACT_VALUE}>
        <span className="numeric">{ranges.conversion}</span>
      </dd>
    </dl>
  );
}

function WindowCell({
  days,
  funnelOnly = false,
  children,
}: {
  days: number;
  funnelOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-2 px-4 py-2 @3xl/impact:border-l @3xl/impact:border-border-subtle @3xl/impact:py-3",
        funnelOnly ? COLUMN_START[days] : null,
      )}
    >
      <h4 className="text-label text-faint-foreground @3xl/impact:sr-only">
        {windowTitle(days)}
      </h4>
      {children}
    </li>
  );
}

export function FunnelOnlyCell({ impact, store }: WindowProps) {
  return (
    <WindowCell days={impact.days} funnelOnly>
      <FunnelFacts impact={impact} store={store} />
    </WindowCell>
  );
}

export function ChangeImpactWindowTile({ impact, store }: WindowProps) {
  const notice = overlapNotice(impact.overlappingChanges);
  const status = windowStatusLine(impact);
  const measured = impact.movement !== null && impact.status === "measured";

  return (
    <WindowCell days={impact.days}>
      {measured ? null : (
        <p className="text-dense text-muted-foreground">{status}</p>
      )}
      <MeasuredFacts impact={impact} />
      <FunnelFacts impact={impact} store={store} />
      {measured && impact.movement ? (
        <p className={NOTE}>{`${status} · ${measuredLine(impact.movement)}`}</p>
      ) : null}
      {notice ? (
        <p className={NOTE}>
          <span className="font-medium text-warning">Overlap. </span>
          <span>{notice}</span>
        </p>
      ) : null}
    </WindowCell>
  );
}

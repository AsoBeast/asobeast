import type { ActionOutcome as Outcome } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DeltaChip, PositionDeltaChip } from "@/components/ui/delta-chip";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  outcomeCaveat,
  outcomeSentence,
  outcomeVerdictLabel,
} from "./action-outcome-copy";
import { METRIC_DIGITS } from "./action-trend-chart";

function ChangeChip({ outcome }: { outcome: Outcome }) {
  const t = useTranslations("actions");
  if (outcome.change === null) return null;
  if (outcome.metric === "position") {
    return (
      <PositionDeltaChip value={outcome.change} period={t("outcome.period")} />
    );
  }
  return (
    <DeltaChip
      value={outcome.change}
      period={t("outcome.period")}
      digits={METRIC_DIGITS[outcome.metric]}
      polarity={
        outcome.direction === "lower_is_better"
          ? "lower-is-better"
          : "higher-is-better"
      }
    />
  );
}

export function ActionOutcome({
  outcome,
  depth,
}: {
  outcome: Outcome;
  depth: number | null;
}) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body">{outcomeSentence(outcome, depth, t, locale)}</p>
      <div className="flex items-center gap-2">
        {outcome.verdict === "pending" ? null : (
          <ChangeChip outcome={outcome} />
        )}
        <Badge variant="outline">
          {outcomeVerdictLabel(outcome.verdict, t)}
        </Badge>
      </div>
      <p className="text-caption text-muted-foreground">{outcomeCaveat(t)}</p>
    </div>
  );
}

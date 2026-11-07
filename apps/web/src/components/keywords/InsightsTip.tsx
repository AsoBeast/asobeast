import { KEYWORD_MIN_RELEVANCE } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import {
  BEATABLE_MIN_POPULARITY,
  DROPPING_MIN_STREAK,
  INSIGHT_LABELS,
  MAX_SHOWN_INSIGHTS,
  PAGE_ONE_CLOSE_MAX_POSITION,
  PAGE_ONE_CLOSE_MIN_POSITION,
} from "@/lib/keyword-insights";

export const INSIGHTS_GUIDE =
  "https://docs.asobeast.com/guides/track-keywords#insights-and-totals";

const RULES = [
  {
    label: INSIGHT_LABELS.dropping,
    rule: `the position got worse on each of the last ${DROPPING_MIN_STREAK} checks.`,
  },
  {
    label: INSIGHT_LABELS.pageOneClose,
    rule: `position ${PAGE_ONE_CLOSE_MIN_POSITION} to ${PAGE_ONE_CLOSE_MAX_POSITION} on a current check.`,
  },
  {
    label: INSIGHT_LABELS.beatable,
    rule: `difficulty is below popularity, and popularity is at least ${BEATABLE_MIN_POPULARITY} and not an Apple floor answer.`,
  },
  {
    label: INSIGHT_LABELS.notInListing,
    rule: `relevance is at least ${KEYWORD_MIN_RELEVANCE} and no field of your listing holds the keyword.`,
  },
];

export function InsightsTip() {
  return (
    <InfoTip
      label="About insights"
      title="Insights"
      summary={`Up to ${MAX_SHOWN_INSIGHTS} verdicts per keyword, worked out from the numbers on its row.`}
    >
      <ul className="flex flex-col gap-1 text-muted-foreground">
        {RULES.map(({ label, rule }) => (
          <li key={label}>
            <span className="font-medium text-foreground">{label}</span>
            <span>{`: ${rule}`}</span>
          </li>
        ))}
      </ul>
      <a
        href={INSIGHTS_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-2"
      >
        Read about insights
      </a>
    </InfoTip>
  );
}

import {
  GAP_TOP,
  GAP_YOU_BELOW,
  THREAT_WINDOW_DAYS,
  THREAT_WITHIN,
  WINNABLE_COMPETITOR_FROM,
} from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";

const RULES = [
  {
    name: "Keyword gaps.",
    rule: `A competitor ranks in the top ${GAP_TOP} and you are unranked or below ${GAP_YOU_BELOW}.`,
  },
  {
    name: "Winnable now.",
    rule: `A gap where difficulty is below popularity, or the best competitor ranks ${WINNABLE_COMPETITOR_FROM} or lower.`,
  },
  {
    name: "Threats.",
    rule: `You rank in the top ${GAP_TOP} and a competitor 1 to ${THREAT_WITHIN} places below you moved up on its last check, or passed you in the last ${THREAT_WINDOW_DAYS} days.`,
  },
  {
    name: "You lead.",
    rule: "You are ahead of every competitor that ranks.",
  },
];

export function GapHelp() {
  return (
    <InfoTip
      label="About gap analysis"
      title="How the gap lists are chosen"
      summary="Four lists over the keywords you track, each rule applied to the latest checks of your app and the competitors you track."
    >
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        {RULES.map(({ name, rule }) => (
          <li key={name}>
            <strong className="text-foreground">{name}</strong>{" "}
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The Gap badge of the comparison matrix uses stricter numbers on purpose:
        it marks only the keywords a competitor holds on the first page.
      </p>
      <a
        href="https://docs.asobeast.com/guides/competitors#gap-analysis"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
      >
        Read how the lists are chosen
      </a>
    </InfoTip>
  );
}

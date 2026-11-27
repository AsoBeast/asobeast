import { createTranslator } from "next-intl";
import { KEYWORD_MIN_RELEVANCE } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { InfoTip } from "@/components/ui/info-tip";
import {
  BEATABLE_MIN_POPULARITY,
  DROPPING_MIN_STREAK,
  insightLabel,
  MAX_SHOWN_INSIGHTS,
  PAGE_ONE_CLOSE_MAX_POSITION,
  PAGE_ONE_CLOSE_MIN_POSITION,
  type KeywordInsight,
} from "@/lib/keyword-insights";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const INSIGHTS_GUIDE =
  "https://docs.asobeast.com/guides/track-keywords#insights-and-totals";

const RULES: {
  insight: KeywordInsight;
  values: Record<string, number>;
}[] = [
  {
    insight: "dropping",
    values: { count: DROPPING_MIN_STREAK },
  },
  {
    insight: "pageOneClose",
    values: {
      from: PAGE_ONE_CLOSE_MIN_POSITION,
      to: PAGE_ONE_CLOSE_MAX_POSITION,
    },
  },
  {
    insight: "beatable",
    values: { count: BEATABLE_MIN_POPULARITY },
  },
  {
    insight: "notInListing",
    values: { count: KEYWORD_MIN_RELEVANCE },
  },
];

export function InsightsTip({ t = english }: { t?: MessageTranslator }) {
  return (
    <InfoTip
      label={t("insights.about")}
      title={t("insights.title")}
      summary={t("insights.summary", { count: MAX_SHOWN_INSIGHTS })}
    >
      <ul className="flex flex-col gap-1 text-muted-foreground">
        {RULES.map(({ insight, values }) => (
          <li key={insight}>
            <span className="font-medium text-foreground">
              {insightLabel(insight, t)}
            </span>
            <span>{`: ${t(`insights.rules.${insight}`, values)}`}</span>
          </li>
        ))}
      </ul>
      <a
        href={INSIGHTS_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("insights.read")}
      </a>
    </InfoTip>
  );
}

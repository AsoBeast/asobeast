import type { CompetitorAnalysis, CompetitorDiscovery } from "@asobeast/shared";
import {
  APP_1_ANALYSIS,
  CROWDED_ICON_URL,
  CROWDED_RIVALS,
} from "./fixtures.mts";

const RTL_TITLE = "مؤقت التركيز";
const LONG_TITLE = "Rival Focus Timer Pro: Deep Work";
const SPECIAL_TITLES: readonly string[] = [RTL_TITLE, LONG_TITLE];

export const NOT_COMPARED_ANALYSIS: CompetitorAnalysis = {
  ...APP_1_ANALYSIS,
  gaps: {
    ...APP_1_ANALYSIS.gaps,
    keywordGaps: [],
    winnable: [],
    threats: [],
    lead: [],
    coverage: {
      competitors: 1,
      delisted: 0,
      markets: [{ country: "us", keywords: 5, compared: 0 }],
    },
  },
};

export const COMPETITOR_GAP_STATES: Record<string, CompetitorAnalysis> = {
  "not-compared": NOT_COMPARED_ANALYSIS,
};

const [YOUR_LISTING] = APP_1_ANALYSIS.metadataComparison;
const [YOUR_POINT] = APP_1_ANALYSIS.positionMap;

export const CROWDED_ANALYSIS: CompetitorAnalysis = {
  ...APP_1_ANALYSIS,
  metadataComparison: [
    YOUR_LISTING,
    ...CROWDED_RIVALS.map(({ id, name }, index) => {
      const title = SPECIAL_TITLES[index] ?? name;
      return {
        appId: id,
        name,
        isYou: false,
        title,
        titleChars: title.length,
        subtitle: index % 3 === 0 ? null : "Deep work timer",
        subtitleChars: index % 3 === 0 ? 0 : 15,
      };
    }),
  ],
  positionMap: [
    YOUR_POINT,
    ...CROWDED_RIVALS.map(({ id, name }, index) => ({
      appId: id,
      name,
      isYou: false,
      visibility: Math.round((88.4 - index * 7.3) * 10) / 10,
      ratingAvg: index === 2 ? null : Math.round((4.8 - index * 0.1) * 10) / 10,
    })),
  ],
};

export function withDiscoveryIcons(
  discovery: CompetitorDiscovery,
): CompetitorDiscovery {
  return {
    ...discovery,
    items: discovery.items.map((item) => ({
      ...item,
      iconUrl: CROWDED_ICON_URL,
    })),
  };
}

export const FAIL_CHANGES_COOKIE = "e2e_fail_changes";

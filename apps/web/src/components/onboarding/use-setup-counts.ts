import { useQuery } from "@tanstack/react-query";
import type { AppDetail, SetupCounts } from "@asobeast/shared";
import { competitorsOptions, keywordsOptions } from "@/lib/queries";
import { activeKeywordCount } from "./setup-progress";

export function useSetupCounts(app: AppDetail) {
  const competitors = useQuery(competitorsOptions(app.id));
  const homeKeywords = useQuery(keywordsOptions(app.id, app.country));
  const counts: SetupCounts = {
    competitors: competitors.data ? competitors.data.length : null,
    keywords: homeKeywords.data ? activeKeywordCount(homeKeywords.data) : null,
  };
  return { competitors, homeKeywords, counts };
}

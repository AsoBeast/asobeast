import type { ActionEvidence } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import zhActions from "../../../messages/zh-CN/actions.json";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatMeasure,
  formatNumberInLocale,
} from "@/lib/format";
import {
  auditCheckLabel,
  auditFactorLabel,
} from "@/components/audit/audit-content-zh";
import { FIELD_KEY } from "./action-headline";

const t = createTranslator({
  locale: "zh-CN",
  namespace: "actions",
  messages: { actions: zhActions },
});

const measure = (value: number | null): string =>
  value === null ? "—" : formatMeasure(value);

const number = (value: number): string => formatNumberInLocale(value, "zh-CN");

const percent = (ratio: number | null): string =>
  ratio === null ? "—" : `${(ratio * 100).toFixed(1)}%`;

const day = (value: string): string => formatDateInLocale(value, "zh-CN");

const fieldsOf = (fields: readonly (keyof typeof FIELD_KEY)[]): string =>
  fields.map((field) => t(`evidenceFields.${FIELD_KEY[field]}`)).join("、");

export function summarizeEvidenceZh(evidence: ActionEvidence): string {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return `机会分 ${measure(evidence.opportunity)}，搜索量 ${measure(evidence.volume)}，且没有索引字段包含它。`;
    case "keyword.defend":
      return `${number(evidence.entrants.length)} 个新应用进入前 10 名，其中 ${number(evidence.entrantsAtOrAbove)} 个排名在你之上。`;
    case "keyword.prune":
      return `${number(evidence.rankedDays)} 次检查中有 ${number(evidence.checkedDays)} 次有排名，每天节省 ${number(evidence.dailyRequestsSaved)} 次请求。`;
    case "rank.investigate_drop":
      return `你在 ${day(evidence.changedAt)} 改动了${fieldsOf(evidence.fields)}，有 ${number(evidence.droppedKeywords.length)} 个跟踪关键词下降。`;
    case "serp.hold_volatile":
      return `这些结果的波动值为 ${measure(evidence.volatility)}/100，今天的变动不是可靠信号。`;
    case "audit.fix_factor":
      return `${auditFactorLabel(evidence.factorId, evidence.factorLabel, "zh-CN")} 在 ${day(evidence.auditDate)} 的审计中得分 ${measure(evidence.score)}/10，权重 ${measure(evidence.weight)}。`;
    case "reviews.investigate_theme":
      return `“${evidence.theme}”出现在 ${number(evidence.mentions)} 条${evidence.version ?? "最新版本"}的负面评论中，此前为 ${number(evidence.previousMentions)} 条。`;
    case "market.improve_country":
      return `${formatCountryInLocale(evidence.country, "zh-CN")} 的可见度落后本土市场 ${measure(evidence.gap)} 点。请关注这个市场。`;
    case "keyword.push_to_top10":
      return `当前第 ${evidence.latestPosition} 名，搜索量 ${measure(evidence.volume)}，在 ${number(evidence.daysInBand)}/${number(evidence.windowDays)} 天里位于 11 到 20 名之间，但只有较弱的字段包含它。`;
    case "rank.investigate_unexplained_drop":
      return `${formatCountryInLocale(evidence.country, "zh-CN")} 可见度从 ${measure(evidence.visibilityBefore)} 降至 ${measure(evidence.visibilityAfter)}，有 ${number(evidence.droppedKeywords.length)} 个关键词下降，且没有你的改动可以解释。`;
    case "competitor.investigate_overtake":
      return `${evidence.competitorName ?? "一个竞品"}在 ${day(evidence.changedAt)} 改动了详情页，此后一直在 ${number(evidence.keywords.length)} 个关键词上领先你。`;
    case "reviews.investigate_rating_decline":
      return `最近 ${number(evidence.recentDays)} 天的评论平均 ${measure(evidence.recentAverage)} 分，此前为 ${measure(evidence.baselineAverage)} 分，且没有单一投诉主题。`;
    case "reviews.reply_negative":
      return `最近 ${number(evidence.windowDays)} 天检查的 ${number(evidence.checked)} 条低分评论中，有 ${number(evidence.unanswered)} 条尚未回复。`;
    case "listing.ship_update":
      return `商店上次显示更新是在 ${number(evidence.daysSinceUpdate)} 天前${evidence.competitorMedianDays === null ? "" : `，竞品中位数为 ${number(evidence.competitorMedianDays)} 天`}。`;
    case "conversion.investigate_drop":
      return `最近 ${number(evidence.windowDays)} 个完整天里，获取次数平均每天 ${measure(evidence.getsAfter)} 次，之前为 ${measure(evidence.getsBefore)} 次，而详情页浏览量保持在 ${measure(evidence.pageViewsAfter)} 对 ${measure(evidence.pageViewsBefore)}。`;
    case "listing.cpp_underperforms":
      return `“${evidence.pageTitle}”在 ${number(evidence.windowDays)} 个完整天里将 ${percent(evidence.pageConversion)} 的详情页浏览量转化为获取次数，默认页为 ${percent(evidence.defaultConversion)}。`;
    case "metadata.fix_lint":
      return `${fieldsOf([evidence.field])}有 ${number(evidence.issues.length)} 个商店规则问题，字符数 ${number(evidence.chars)}/${number(evidence.limit)}。`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

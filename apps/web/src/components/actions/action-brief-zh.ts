import type {
  ActionEvidence,
  ActionRule,
  ActionSerpEntrant,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import zhActions from "../../../messages/zh-CN/actions.json";
import {
  formatDateInLocale,
  formatListInLocale,
  formatMeasure,
  formatMeasureFixed,
  formatMeasurePair,
  formatNumberInLocale,
} from "@/lib/format";
import {
  auditCheckLabel,
  auditFactorLabel,
} from "@/components/audit/audit-content-zh";
import { actionRuleLabel } from "./action-copy";
import { changedFields, FIELD_KEY } from "./action-headline";

type BriefSegment = string | { strong: string };
type BriefPart = BriefSegment[];

const t = createTranslator({
  locale: "zh-CN",
  namespace: "actions",
  messages: { actions: zhActions },
});

const strong = (value: string): BriefSegment => ({ strong: value });
const number = (value: number): string => formatNumberInLocale(value, "zh-CN");
const rank = (position: number): string => `#${number(position)}`;
const day = (value: string): string => formatDateInLocale(value, "zh-CN");
const measure = (value: number | null): string =>
  value === null ? "—" : formatMeasure(value);
const percent = (ratio: number | null): string =>
  ratio === null ? "—" : `${(ratio * 100).toFixed(1)}%`;

const fieldWords = (fields: readonly (keyof typeof FIELD_KEY)[]): string =>
  fields.map((field) => t(`evidenceFields.${FIELD_KEY[field]}`)).join("、");

function present(parts: Array<BriefPart | null>): BriefPart[] {
  return parts.filter((part): part is BriefPart => part !== null);
}

function entrantsPart(entrants: readonly ActionSerpEntrant[]): BriefPart {
  if (entrants.length === 0) return ["你之上没有新应用"];
  const named = entrants
    .slice(0, 2)
    .map((entrant) => `${entrant.title} 在第 ${rank(entrant.position)} 名进入`);
  const more = entrants.length - named.length;
  return [more > 0 ? `${named.join("、")}，另有 ${more} 个` : named.join("、")];
}

function movedPart(
  previous: number | null,
  current: number | null,
): BriefPart | null {
  if (current === null) return null;
  if (previous === null) return ["你目前位列 ", strong(rank(current))];
  return [
    "你从第 ",
    strong(rank(previous)),
    " 名升至第 ",
    strong(rank(current)),
    " 名",
  ];
}

function fellPart(
  before: number | null,
  after: number | null,
): BriefPart | null {
  if (before === null || after === null) return null;
  return [
    "可见度从 ",
    strong(formatMeasureFixed(before)),
    " 降至 ",
    strong(formatMeasureFixed(after)),
  ];
}

type EvidenceOf<R extends ActionRule> = Extract<ActionEvidence, { rule: R }>;

const BRIEFS: {
  [R in ActionRule]: (evidence: EvidenceOf<R>) => BriefPart[];
} = {
  "keyword.add_uncovered": (evidence) =>
    present([
      ["机会分 ", strong(measure(evidence.opportunity))],
      evidence.volume === null
        ? null
        : ["搜索量 ", strong(measure(evidence.volume))],
      evidence.latestPosition === null
        ? null
        : [`当前${strong(rank(evidence.latestPosition))}名`],
      evidence.uncoveredFields.length === 0
        ? null
        : [
            evidence.uncoveredFields.length === evidence.indexedFields.length
              ? "没有索引字段包含它"
              : `缺少${fieldWords(evidence.uncoveredFields)}`,
          ],
      evidence.keywordFieldCharsFree
        ? [
            strong(number(evidence.keywordFieldCharsFree)),
            " 个关键词字段字符可用",
          ]
        : null,
    ]),
  "keyword.defend": (evidence) =>
    present([
      movedPart(evidence.previousPosition, evidence.yourPosition),
      entrantsPart(evidence.entrants),
    ]),
  "keyword.prune": (evidence) =>
    present([
      evidence.rankedDays === 0
        ? ["在 ", strong(number(evidence.checkedDays)), " 次检查中从未获得排名"]
        : [
            "在 ",
            strong(
              `${number(evidence.rankedDays)} / ${number(evidence.checkedDays)}`,
            ),
            " 次检查中有排名",
          ],
      evidence.volume === null ? null : [`搜索量 ${measure(evidence.volume)}`],
      [`每天节省 ${number(evidence.dailyRequestsSaved)} 次请求`],
    ]),
  "rank.investigate_drop": (evidence) =>
    present([
      fellPart(evidence.visibilityBefore, evidence.visibilityAfter),
      [
        `你的${changedFields(evidence.fields, t, "zh-CN")}在 ${day(evidence.changedAt)} 改动`,
      ],
      [`${number(evidence.droppedKeywords.length)} 个关键词下降`],
    ]),
  "serp.hold_volatile": (evidence) =>
    present([
      [
        "波动值 ",
        strong(`${measure(evidence.volatility)}/100`),
        `，持续 ${number(evidence.windowDays)} 天`,
      ],
      evidence.yourPosition === null
        ? null
        : [`你目前位列${rank(evidence.yourPosition)}`],
      evidence.dampenedRules.length === 0
        ? null
        : [
            `暂缓 ${formatListInLocale(
              evidence.dampenedRules.map((rule) => actionRuleLabel(rule, t)),
              "zh-CN",
            )}`,
          ],
    ]),
  "audit.fix_factor": (evidence) =>
    present([
      [
        "在审计中占 ",
        strong(
          `${measure(evidence.weight)} / ${measure(evidence.totalWeight)}`,
        ),
        " 的权重",
      ],
      evidence.failingChecks.length === 0
        ? null
        : [
            `未通过：${formatListInLocale(
              evidence.failingChecks.map((check) =>
                auditCheckLabel(check.id, check.label, "zh-CN"),
              ),
              "zh-CN",
            )}`,
          ],
    ]),
  "reviews.investigate_theme": (evidence) => [
    [
      strong(number(evidence.mentions)),
      ` 条提及，来自${evidence.version ?? "最新版本"}，此前为 ${number(evidence.previousMentions)} 条`,
    ],
    [
      `${number(evidence.negativeReviews)} / ${number(evidence.totalReviews)} 条评论为负面`,
    ],
  ],
  "market.improve_country": (evidence) => [
    [
      "可见度 ",
      strong(formatMeasureFixed(evidence.marketVisibility)),
      `，本土为 ${formatMeasureFixed(evidence.homeVisibility)}`,
    ],
    [
      `${number(evidence.rankedKeywords)} / ${number(evidence.trackedKeywords)} 个关键词有排名`,
    ],
  ],
  "keyword.push_to_top10": (evidence) =>
    present([
      [
        "当前",
        strong(rank(evidence.latestPosition)),
        `，最佳${rank(evidence.bestPosition)}`,
      ],
      [
        `${number(evidence.daysInBand)} / ${number(evidence.windowDays)} 天位于 11 到 20 名`,
      ],
      evidence.coveredFields.length === 0
        ? null
        : [`仅在${fieldWords(evidence.coveredFields)}中`],
    ]),
  "metadata.fix_lint": (evidence) => [
    [
      `${t(`evidenceFields.${FIELD_KEY[evidence.field]}`)}为 `,
      strong(`${number(evidence.chars)} / ${number(evidence.limit)}`),
      " 个字符",
    ],
  ],
  "rank.investigate_unexplained_drop": (evidence) =>
    present([
      fellPart(evidence.visibilityBefore, evidence.visibilityAfter),
      [`${number(evidence.windowDays)} 天没有你的改动`],
      [`${number(evidence.droppedKeywords.length)} 个关键词下降`],
    ]),
  "competitor.investigate_overtake": (evidence) => {
    const text = evidence.newTitle ?? evidence.newSubtitle;
    const named = evidence.keywords.slice(0, 2).map((keyword) => keyword.text);
    const more = evidence.keywords.length - named.length;
    const ahead = more > 0 ? [...named, `另有 ${more} 个`] : named;
    return present([
      text === null
        ? null
        : [
            `新的${evidence.newTitle === null ? "副标题" : "标题"} `,
            strong(`“${text}”`),
          ],
      ahead.length === 0
        ? null
        : [`在${formatListInLocale(ahead, "zh-CN")}上领先你`],
    ]);
  },
  "reviews.investigate_rating_decline": (evidence) =>
    present([
      [
        strong(number(evidence.recentReviews)),
        ` 条评论，最近 ${number(evidence.recentDays)} 天`,
      ],
      evidence.latestVersion === null
        ? null
        : [`最新版本 ${evidence.latestVersion}`],
      ["没有单一主题"],
    ]),
  "reviews.reply_negative": (evidence) =>
    present([
      [
        strong(`${number(evidence.unanswered)} / ${number(evidence.checked)}`),
        " 条低分评论未回复",
      ],
      evidence.replyRate === null
        ? null
        : [`回复率 ${percent(evidence.replyRate)}`],
      evidence.oldestUnansweredAt === null
        ? null
        : [`最早来自 ${day(evidence.oldestUnansweredAt)}`],
    ]),
  "listing.ship_update": (evidence) =>
    present([
      ["上次更新 ", strong(day(evidence.storeUpdatedAt))],
      evidence.competitorMedianDays === null
        ? null
        : [
            `竞品每 ${measure(evidence.competitorMedianDays)} 天更新一次（${number(evidence.competitorsCompared)} 个竞品的中位数）`,
          ],
    ]),
  "conversion.investigate_drop": (evidence) => {
    const [getsBefore, getsAfter] = formatMeasurePair(
      evidence.getsBefore,
      evidence.getsAfter,
    );
    return present([
      [
        "获取次数从 ",
        strong(getsBefore),
        " 降至 ",
        strong(getsAfter),
        " 次/天",
      ],
      [
        `详情页浏览量 ${formatMeasurePair(evidence.pageViewsBefore, evidence.pageViewsAfter).join(" 至 ")}`,
      ],
      evidence.conversionBefore === null || evidence.conversionAfter === null
        ? null
        : [
            `转化率 ${percent(evidence.conversionBefore)} 至 ${percent(evidence.conversionAfter)}`,
          ],
    ]);
  },
  "listing.cpp_underperforms": (evidence) => [
    [
      strong(percent(evidence.pageConversion)),
      ` 的详情页浏览量转化为获取次数，默认页为 ${percent(evidence.defaultConversion)}`,
    ],
    [`${number(evidence.windowDays)} 天`],
  ],
};

export function actionBriefZh(evidence: ActionEvidence): BriefPart[] {
  switch (evidence.rule) {
    case "keyword.add_uncovered":
    case "keyword.defend":
    case "keyword.prune":
    case "rank.investigate_drop":
    case "serp.hold_volatile":
    case "audit.fix_factor":
    case "reviews.investigate_theme":
    case "market.improve_country":
    case "keyword.push_to_top10":
    case "metadata.fix_lint":
    case "rank.investigate_unexplained_drop":
    case "competitor.investigate_overtake":
    case "reviews.investigate_rating_decline":
    case "reviews.reply_negative":
    case "listing.ship_update":
    case "conversion.investigate_drop":
    case "listing.cpp_underperforms":
      return BRIEFS[evidence.rule](evidence as never);
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

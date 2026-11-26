import {
  type ActionEvidence,
  type ActionItem,
  type ActionRule,
  type Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import zhActions from "../../../messages/zh-CN/actions.json";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import {
  auditCheckLabel,
  auditFactorLabel,
} from "@/components/audit/audit-content-zh";
import { actionRuleLabel } from "./action-copy";
import { changedFields } from "./action-headline";

const t = createTranslator({
  locale: "zh-CN",
  namespace: "actions",
  messages: { actions: zhActions },
});

const CONFIRMATION = "当这条建议不再触发时，AsoBeast 会确认问题已修复";

const RULE_CONFIRMATION: Partial<Record<ActionRule, string>> = {
  "keyword.push_to_top10":
    "当关键词进入前 10 名或不再符合条件时，AsoBeast 会确认问题已修复",
  "listing.ship_update": "当商店显示新版本时，AsoBeast 会确认问题已修复",
  "conversion.investigate_drop":
    "当获取次数相对于详情页浏览量恢复时，AsoBeast 会确认问题已修复",
  "listing.cpp_underperforms":
    "当该页面转化率达到默认页面的五分之四时，AsoBeast 会确认问题已修复",
};

const confirmationStep = (rule: ActionRule): string =>
  RULE_CONFIRMATION[rule] ?? CONFIRMATION;

const STORE_CONSOLE: Record<Store, string> = {
  APP_STORE: "App Store Connect",
  GOOGLE_PLAY: "Play Console",
};

const STRONG_FIELDS: Record<Store, string> = {
  APP_STORE: "标题和副标题",
  GOOGLE_PLAY: "标题和简短描述",
};

const number = (value: number): string => formatNumberInLocale(value, "zh-CN");

function addKeywordSteps(
  keyword: string,
  store: Store,
  charsFree: number | null,
): string[] {
  if (store === "GOOGLE_PLAY") {
    return [
      "打开详情页工作台",
      `将 ${keyword} 加入标题或简短描述`,
      "在完整描述中自然使用这个词",
      "在 Play Console 发布详情页改动",
    ];
  }
  const room =
    charsFree !== null && charsFree > 0
      ? `（剩余 ${number(charsFree)} 个字符）`
      : "";
  return [
    "打开详情页工作台",
    `将 ${keyword} 放入副标题，或放入关键词字段${room}`,
    "随下一个版本发布改动",
  ];
}

function pushSteps(keyword: string, store: Store): string[] {
  return store === "GOOGLE_PLAY"
    ? [
        `将 ${keyword} 加入标题或简短描述`,
        "保持词语完整且顺序不变",
        "在 Play Console 发布详情页改动",
      ]
    : [
        `将 ${keyword} 移到副标题或标题中`,
        "保持词语完整且顺序不变",
        "随下一个版本发布",
      ];
}

function defendSteps(
  keyword: string,
  store: Store,
  competitorBrand: boolean,
): string[] {
  const watch = `查看哪些应用进入了 ${keyword} 的前 10 名`;
  return competitorBrand
    ? [watch, `${keyword} 是竞品品牌，不要放进自己的详情页`]
    : [
        watch,
        `对比他们的${STRONG_FIELDS[store]}与你的`,
        `如果这个位置重要，就在你最强的字段中加强 ${keyword}`,
      ];
}

function ruleSteps(
  evidence: ActionEvidence,
  item: ActionItem,
  keyword: string,
): string[] {
  const { store, country } = item.scope;
  switch (evidence.rule) {
    case "keyword.add_uncovered":
      return addKeywordSteps(keyword, store, evidence.keywordFieldCharsFree);
    case "keyword.defend":
      return defendSteps(keyword, store, evidence.competitorBrand === true);
    case "keyword.prune":
      return [
        `在关键词监控页检查 ${keyword}`,
        "暂停它可每天节省一次请求；如果对你重要也可以保留",
      ];
    case "rank.investigate_drop":
      return [
        `查看 ${formatDateInLocale(evidence.changedAt, "zh-CN")} 前后的详情页改动`,
        "把下降的关键词与你改动的文案对比",
        "如果下降持续，撤回或调整改动",
      ];
    case "serp.hold_volatile":
      return [`先不要为 ${keyword} 改动元数据`, "等搜索结果稳定后再检查"];
    case "audit.fix_factor":
      const factor = auditFactorLabel(
        evidence.factorId,
        evidence.factorLabel,
        "zh-CN",
      );
      return [
        `打开“${factor}”的审计`,
        ...(evidence.failingChecks.length > 0
          ? evidence.failingChecks.map(
              (check) =>
                `修复：${auditCheckLabel(check.id, check.label, "zh-CN")}`,
            )
          : [`按审计建议逐项处理${factor}`]),
      ];
    case "reviews.investigate_theme":
      return [
        `阅读提到“${evidence.theme}”的低分评论`,
        `检查${evidence.version ?? "最新版本"}中发生了什么改动`,
        "在评论页回复，说明修复进展",
      ];
    case "market.improve_country":
      return [
        `打开 ${formatCountryInLocale(country, "zh-CN")} 的关键词监控`,
        "找出在本土市场有排名、但这里没有的关键词",
        "考虑为这个市场本地化详情页",
      ];
    case "keyword.push_to_top10":
      return pushSteps(keyword, store);
    case "rank.investigate_unexplained_drop":
      return [
        "检查下降关键词的关键词监控",
        "查看同一天竞品的改动和新入围者",
        "在查明原因前不要改动详情页",
      ];
    case "competitor.investigate_overtake":
      return [
        `对比他们新的${changedFields(evidence.fields, t, "zh-CN")}与你的`,
        "判断他们现在瞄准的关键词对你是否重要",
        "在你希望保住的关键词上加强覆盖",
      ];
    case "reviews.investigate_rating_decline":
      return [
        "阅读近期低分评论",
        `检查${evidence.latestVersion ?? "最新版本"}中发生了什么改动`,
        "在评论页回复，说明修复进展",
      ];
    case "reviews.reply_negative":
      return [
        "打开需要回复的低分评论，从最低分开始",
        `起草或写好每条回复，复制并粘贴到 ${STORE_CONSOLE[store]}`,
        "标记为已回复；AsoBeast 次日也会在商店看到这条回复",
      ];
    case "listing.ship_update":
      return ["安排一次发布，哪怕改动很小", "写清楚改了什么的更新说明"];
    case "conversion.investigate_drop":
      return [
        "对比概览中的商店漏斗与同一天的详情页改动",
        "检查截图、图标、评分和用户看到的价格",
        "一次只改一处，观察一周转化",
      ];
    case "listing.cpp_underperforms":
      return [
        `在 App Store Connect 中打开“${evidence.pageTitle}”`,
        "让首屏截图与带来流量的关键词或广告承诺保持一致",
        "或者把这些流量改指向默认产品详情页",
      ];
    case "metadata.fix_lint":
      return [
        ...evidence.issues.map((issue) => issue.message),
        "保存并发布详情页改动",
      ];
    default: {
      const never: never = evidence;
      return never;
    }
  }
}

export function actionStepsZh(item: ActionItem): string[] {
  if (item.evidence === null) {
    return [actionRuleLabel(item.rule, t), confirmationStep(item.rule)];
  }
  const keyword = item.scope.keywordText
    ? `"${item.scope.keywordText}"`
    : "关键词";
  return [
    ...ruleSteps(item.evidence, item, keyword),
    confirmationStep(item.rule),
  ];
}

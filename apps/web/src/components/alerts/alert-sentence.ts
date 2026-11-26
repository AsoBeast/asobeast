import {
  countChars,
  isRanked,
  SERP_DEPTH,
  truncateChars,
  type ActionPriority,
  type ActionRule,
  type AlertEventItem,
  type CategoryCollection,
  type ChangeField,
  type GranularAlertPayload,
  type RankMilestoneDirection,
  type RankMilestoneTier,
} from "@asobeast/shared";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";

export const CHANGE_FIELD_ZH: Record<ChangeField, string> = {
  title: "标题",
  subtitle: "副标题",
  summary: "简短描述",
  description: "描述",
  version: "版本",
  price: "价格",
  screenshots: "截图",
  screenshotImages: "截图图片",
  screenshotCaptions: "截图说明",
  icon: "图标",
  whatsNew: "更新说明",
  inAppEvents: "应用内活动",
  featuring: "精选推荐",
  editorsChoice: "编辑精选",
};

export const RULE_ZH: Record<ActionRule, string> = {
  "keyword.add_uncovered": "为详情页添加高机会关键词",
  "keyword.defend": "防守竞品刚进入的关键词",
  "keyword.prune": "停用一直没有排名的关键词",
  "rank.investigate_drop": "排查详情页改动后的排名下降",
  "serp.hold_volatile": "搜索结果异常波动，暂缓处理",
  "audit.fix_factor": "修复较弱的审计因素",
  "reviews.investigate_theme": "排查新的负面评论主题",
  "market.improve_country": "排查表现不佳的市场",
  "keyword.push_to_top10": "推动关键词进入前 10 名",
  "metadata.fix_lint": "修复违反商店规则的详情页文案",
  "rank.investigate_unexplained_drop": "排查没有改动相伴的排名下降",
  "competitor.investigate_overtake": "应对超越你的竞品",
  "reviews.investigate_rating_decline": "排查评分下降",
  "reviews.reply_negative": "回复未答复的低分评论",
  "listing.ship_update": "为久未更新的详情页发布更新",
  "conversion.investigate_drop": "排查详情页浏览量稳定但下载减少",
  "listing.cpp_underperforms": "重做转化低于默认页的自定义产品页",
};

const PRIORITY_ZH: Record<ActionPriority, string> = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

const COLLECTION_ZH: Record<CategoryCollection, string> = {
  free: "免费榜",
  paid: "付费榜",
  grossing: "畅销榜",
};

const APP_ANONYMOUS = "一个应用";
const VALUE_MAX = 80;

const appName = (name: string | null | undefined): string =>
  name ?? APP_ANONYMOUS;

const count = (value: number, locale: Locale): string =>
  formatNumberInLocale(value, locale);

const inCountry = (code: string | null | undefined, locale: Locale): string =>
  code ? formatCountryInLocale(code, locale) : "";

const rankPhrase = (position: number | null, depth: number): string =>
  isRanked(position) ? `第 ${position} 名` : `前 ${depth} 名之外`;

const keywordSubject = (
  keyword: { text: string; country?: string },
  locale: Locale,
): string => {
  const market = inCountry(keyword.country, locale);
  return market
    ? `${market}的关键词“${keyword.text}”`
    : `关键词“${keyword.text}”`;
};

const quotedReview = (text: string): string => {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return "未写评论";
  const clipped =
    countChars(trimmed) > VALUE_MAX
      ? `${truncateChars(trimmed, VALUE_MAX - 1)}…`
      : trimmed;
  return `“${clipped}”`;
};

const milestonePhrase = (
  tier: RankMilestoneTier,
  direction: RankMilestoneDirection,
): string => {
  if (tier === 1) {
    return direction === "entered" ? "升至第一名" : "失去第一名";
  }
  return direction === "entered" ? `进入前 ${tier} 名` : `跌出前 ${tier} 名`;
};

const competitorName = (name: string | null | undefined): string =>
  `${appName(name)}（竞品）`;

const storeName = (store: "APP_STORE" | "GOOGLE_PLAY"): string =>
  store === "GOOGLE_PLAY" ? "Google Play" : "App Store";

function chartPlace(
  payload: Extract<GranularAlertPayload, { chart: unknown }>,
  locale: Locale,
): string {
  const { chart } = payload;
  const place = `${COLLECTION_ZH[chart.collection]} · ${chart.genreName}`;
  const market = inCountry(chart.country, locale);
  return market ? `${place}（${market}）` : place;
}

function reviewSentence(
  payload: Extract<
    GranularAlertPayload,
    { event: "review.negative" | "review.new" }
  >,
  locale: Locale,
): string {
  const { score, text, version } = payload.review;
  const author =
    payload.event === "review.new" ? payload.review.author?.trim() : undefined;
  const from = author ? `，来自 ${author}` : "";
  const shipped = version ? `，v${version}` : "";
  return `${appName(payload.app.name)}收到一条 ${count(score, locale)} 星评论${from}${shipped}：${quotedReview(text)}`;
}

function chartSentence(
  payload: Extract<GranularAlertPayload, { event: `chart.${string}` }>,
  locale: Locale,
): string {
  const app = appName(payload.app.name);
  const where = chartPlace(payload, locale);
  switch (payload.event) {
    case "chart.entered":
      return `${app}进入${where}，位列第 ${count(payload.to, locale)} 名`;
    case "chart.left":
      return `${app}退出${where}，此前位列第 ${count(payload.from, locale)} 名`;
    case "chart.milestone":
      return `${app}在${where}${milestonePhrase(payload.tier, payload.direction)}：${rankPhrase(payload.from, payload.depth)} → ${rankPhrase(payload.to, payload.depth)}`;
    default: {
      const never: never = payload;
      return never;
    }
  }
}

function availabilitySentence(
  payload: Extract<
    GranularAlertPayload,
    { event: "app.delisted" | "app.unlisted_market" }
  >,
  locale: Locale,
): string {
  const who = payload.app.isCompetitor
    ? competitorName(payload.app.name)
    : appName(payload.app.name);
  const listed = `${who}已从${storeName(payload.store)}下架`;
  if (payload.event === "app.delisted") {
    const home = inCountry(payload.country, locale);
    return home ? `${listed}（${home}）` : listed;
  }
  const market = inCountry(payload.market, locale);
  if (!market) return listed;
  return payload.trackedKeywords > 0
    ? `${who}已从${storeName(payload.store)}的${market}市场下架，该市场跟踪了 ${count(payload.trackedKeywords, locale)} 个关键词`
    : `${who}已从${storeName(payload.store)}的${market}市场下架`;
}

type RankPayload = Extract<GranularAlertPayload, { event: `rank.${string}` }>;
type ReviewPayload = Extract<
  GranularAlertPayload,
  { event: "review.negative" | "review.new" }
>;
type AvailabilityPayload = Extract<
  GranularAlertPayload,
  { event: "app.delisted" | "app.unlisted_market" }
>;
type ChartPayload = Extract<GranularAlertPayload, { event: `chart.${string}` }>;

const isRankPayload = (payload: GranularAlertPayload): payload is RankPayload =>
  payload.event.startsWith("rank.");

const isReviewPayload = (
  payload: GranularAlertPayload,
): payload is ReviewPayload =>
  payload.event === "review.negative" || payload.event === "review.new";

const isAvailabilityPayload = (
  payload: GranularAlertPayload,
): payload is AvailabilityPayload =>
  payload.event === "app.delisted" || payload.event === "app.unlisted_market";

const isChartPayload = (
  payload: GranularAlertPayload,
): payload is ChartPayload => payload.event.startsWith("chart.");

function rankSentence(payload: RankPayload, locale: Locale): string {
  switch (payload.event) {
    case "rank.dropped": {
      const keyword = keywordSubject(payload.keyword, locale);
      const app = appName(payload.app.name);
      return isRanked(payload.to)
        ? `${app}在${keyword}上从第 ${payload.from} 名降至第 ${payload.to} 名`
        : `${app}在${keyword}上跌出前 ${payload.toDepth} 名，此前为${rankPhrase(payload.from, payload.fromDepth)}`;
    }
    case "rank.improved": {
      const keyword = keywordSubject(payload.keyword, locale);
      return `${appName(payload.app.name)}在${keyword}上从${rankPhrase(payload.from, payload.fromDepth)}升至${rankPhrase(payload.to, payload.toDepth)}`;
    }
    case "rank.milestone": {
      const keyword = keywordSubject(payload.keyword, locale);
      return `${appName(payload.app.name)}在${keyword}上${milestonePhrase(payload.tier, payload.direction)}：${rankPhrase(payload.from, payload.fromDepth)} → ${rankPhrase(payload.to, payload.toDepth)}`;
    }
    case "rank.first":
      return `${appName(payload.app.name)}首次在${keywordSubject(payload.keyword, locale)}上获得排名，位列第 ${payload.position} 名`;
    case "rank.overtaken": {
      const app = appName(payload.app.name);
      const rival = appName(payload.competitor.name);
      const keyword = keywordSubject(payload.keyword, locale);
      return `${rival}在${keyword}上超越了${app}：${rival} ${rankPhrase(payload.competitor.from, payload.fromDepth)} → ${rankPhrase(payload.competitor.to, payload.toDepth)}，${app} ${rankPhrase(payload.from, payload.fromDepth)} → ${rankPhrase(payload.to, payload.toDepth)}`;
    }
    default: {
      const never: never = payload;
      return never;
    }
  }
}

function metadataSentence(
  payload: Extract<GranularAlertPayload, { event: "metadata.changed" }>,
): string {
  const fields = [
    ...new Set(payload.changes.map((change) => CHANGE_FIELD_ZH[change.field])),
  ];
  const who = payload.app.isCompetitor
    ? competitorName(payload.app.name)
    : appName(payload.app.name);
  return `${who}更改了${fields.join("、")}`;
}

function ratingSentence(
  payload: Extract<GranularAlertPayload, { event: "rating.dropped" }>,
  locale: Locale,
): string {
  const days = Math.round(
    (Date.parse(payload.toDate) - Date.parse(payload.fromDate)) / 86_400_000,
  );
  const market = inCountry(payload.country, locale);
  const where = market ? `在${market}` : "";
  const shipped = payload.version
    ? `，自 v${payload.version.replace(/^v/i, "")} 发布以来`
    : "";
  return `${appName(payload.app.name)}${where}的平均评分在 ${count(days, locale)} 天内从 ${payload.from.toFixed(2)} 降至 ${payload.to.toFixed(2)}${shipped}`;
}

function spikeSentence(
  payload: Extract<GranularAlertPayload, { event: "review.spike" }>,
  locale: Locale,
): string {
  const date = formatDateInLocale(payload.date, locale);
  const low = `${Math.round(payload.lowShare * 100)}% 为 ${payload.lowScoreMax} 星及以下`;
  return `${appName(payload.app.name)}在 ${date} 收到 ${count(payload.count, locale)} 条评论，平日中位数为每天 ${count(payload.median, locale)} 条，其中 ${low}`;
}

function entrantSentence(
  payload: Extract<GranularAlertPayload, { event: "serp.entrant" }>,
  locale: Locale,
): string {
  const names = payload.entrants
    .map(
      (entrant) =>
        `#${entrant.position} ${entrant.title}${entrant.isCompetitor ? "（竞品）" : ""}`,
    )
    .join("、");
  return `${keywordSubject(payload.keyword, locale)}新入围前 ${SERP_DEPTH} 名：${names}`;
}

function actionSentence(
  payload: Extract<GranularAlertPayload, { event: "action.opened" }>,
  locale: Locale,
): string {
  const kind = payload.action.reopened ? "重新打开的行动" : "行动";
  const rule = RULE_ZH[payload.action.rule];
  return `${appName(payload.app.name)}出现一条${PRIORITY_ZH[payload.action.priority]}优先级${kind}：${rule}（影响 ${count(payload.action.impact, locale)}）`;
}

function digestSentence(
  payload: Extract<GranularAlertPayload, { event: "digest.weekly" }>,
  locale: Locale,
): string {
  const from = formatDateInLocale(payload.window.from, locale);
  const to = formatDateInLocale(payload.window.to, locale);
  return `每周摘要：${count(payload.apps.length, locale)} 个应用，${from} 至 ${to}`;
}

function sentenceOf(payload: GranularAlertPayload, locale: Locale): string {
  if (isRankPayload(payload)) return rankSentence(payload, locale);
  if (isReviewPayload(payload)) return reviewSentence(payload, locale);
  if (isAvailabilityPayload(payload))
    return availabilitySentence(payload, locale);
  if (isChartPayload(payload)) return chartSentence(payload, locale);
  switch (payload.event) {
    case "metadata.changed":
      return metadataSentence(payload);
    case "rating.dropped":
      return ratingSentence(payload, locale);
    case "review.spike":
      return spikeSentence(payload, locale);
    case "serp.entrant":
      return entrantSentence(payload, locale);
    case "action.opened":
      return actionSentence(payload, locale);
    case "digest.weekly":
      return digestSentence(payload, locale);
    default: {
      const never: never = payload;
      return never;
    }
  }
}

export function alertSentence(item: AlertEventItem, locale: Locale): string {
  return locale === "zh-CN" ? sentenceOf(item.payload, locale) : item.sentence;
}

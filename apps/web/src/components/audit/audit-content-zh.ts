import type { Locale } from "@/lib/locale";

const FACTOR_LABEL_ZH: Record<string, string> = {
  title: "标题",
  subtitle: "副标题",
  keywordField: "关键词字段",
  shortDescription: "简短描述",
  description: "描述",
  screenshots: "截图",
  previewVideo: "预览视频",
  ratings: "评分与评论",
  icon: "图标",
  rankings: "关键词排名",
  conversion: "新鲜度与信任",
};

const CHECK_LABEL_ZH: Record<string, string> = {
  "screenshots-caption-keywords": "说明中的关键词",
  "ratings-average": "平均评分",
  "ratings-volume": "评分数量",
  "ratings-recent": "近期评论",
  "ratings-current-version": "当前版本评分",
  "ratings-responses": "低分评论回复",
  "screenshots-count": "截图数量",
  "screenshots-ipad": "iPad 截图",
  "screenshots-feature-graphic": "特色图片",
  "screenshots-captions": "可读说明",
  "screenshots-first-message": "首张截图信息",
  "screenshots-consistency": "设计一致性",
  "screenshots-localized": "本地化说明",
  "preview-video-present": "预览视频",
  "icon-no-text": "图标无文字",
  "icon-simplicity": "简洁度",
  "icon-contrast": "对比度",
  "icon-distinct": "与竞品区分度",
  "rankings-visibility": "搜索可见度",
  "rankings-top10": "前 10 名关键词",
  "rankings-trend": "7 天可见度变化",
  "rankings-competitor-gap": "竞品关键词差距",
  "title-keyword": "标题中的主关键词",
  "title-length": "字符使用",
  "title-policy": "商店规则与格式",
  "title-uniqueness": "与竞品区分度",
  "subtitle-keyword": "优先关键词",
  "subtitle-length": "字符使用",
  "subtitle-no-repetition": "不与标题重复",
  "keyword-field-saved": "关键词字段",
  "keyword-field-length": "字符使用",
  "keyword-field-hygiene": "关键词字段规范",
  "keyword-field-relevance": "关键词相关性",
  "description-cta": "行动号召",
  "description-social-proof": "社会证明",
  "description-formatting": "可读排版",
  "description-keyword-coverage": "优先关键词覆盖",
  "description-keyword-frequency": "主关键词频次",
  "description-above-fold": "首屏关键词",
  "description-hook": "开篇吸引力",
  "short-description-keyword": "优先关键词",
  "short-description-length": "字符使用",
  "short-description-no-repetition": "不与标题重复",
  "short-description-policy": "商店规则",
  "conversion-update-recency": "更新时效",
  "conversion-release-notes": "更新说明",
  "conversion-localizations": "本地化",
  "conversion-privacy-policy": "隐私政策",
};

const UNLOCK_LABEL_ZH: Record<string, string> = {
  keywords: "为关键词评分，找出主关键词",
  competitors: "添加竞品以对比标题和图标",
  "keyword-field": "从 App Store Connect 粘贴关键词字段",
  "ai-analysis": "添加 OPENAI_API_KEY 以分析图标和截图",
  history: "需要 7 天的排名历史",
  reviews: "需要最近 30 天的 5 条评论",
};

const BENCHMARK_LABEL_ZH: Record<string, string> = {
  "rating-average": "平均评分",
  "rating-count": "评分数量",
  screenshots: "截图",
  "has-video": "预览视频",
  "title-length": "标题字符数",
  "subtitle-length": "副标题字符数",
  "days-since-update": "距上次更新天数",
};

const READINESS_LABEL_ZH: Record<string, string> = {
  "preview-video": "预览视频",
  "in-app-events": "应用内活动",
  nominations: "精选提名",
  "promotional-text": "推广文本",
  rating: "平均评分",
  "update-recency": "更新时效",
  localizations: "本地化",
  screenshots: "截图",
  accessibility: "辅助功能",
};

const READINESS_LINK_ZH: Record<string, string> = {
  "https://developer.apple.com/app-store/in-app-events/": "了解应用内活动",
  "#factors-conversion": "查看审计评分位置",
};

const LIMITATION_ZH: Record<string, { label: string; detail: string }> = {
  "in-app-events": {
    label: "过往应用内活动及其表现",
    detail:
      "商店页面只显示正在进行或即将开始的活动；已结束的活动及每项活动的表现仅在 App Store Connect 中可见。",
  },
  "accessibility-features": {
    label: "声明的辅助功能",
    detail: "页面读取还无法区分开发者声明的功能与 Apple 在未声明时显示的说明。",
  },
  "custom-product-pages": {
    label: "自定义产品页",
    detail:
      "AsoBeast 看不到自定义产品页。最多 70 个，分配了关键词的页面会出现在这些关键词的自然搜索中。",
  },
  "review-replies": {
    label: "评论回复",
    detail: "AsoBeast 读取的 App Store 评论数据不包含开发者回复。",
  },
  "rating-prompts": {
    label: "评分弹窗",
    detail: "发生在你的应用内部：在成功时刻后请求评分，每年最多三次。",
  },
  "conversion-rate": {
    label: "产品页转化率",
    detail: "仅来自 App Store Connect 分析数据。",
  },
  "video-content": {
    label: "宣传视频内容",
    detail: "AsoBeast 只能看到视频是否关联，看不到视频内容。",
  },
  "promotional-content": {
    label: "推广内容",
    detail: "从 Play Console 发布的活动和优惠对 AsoBeast 不可见。",
  },
  "custom-store-listings": {
    label: "自定义商店详情页",
    detail: "AsoBeast 看不到自定义详情页。按国家、受众或活动最多 50 个变体。",
  },
  "store-listing-experiments": {
    label: "商店详情页实验",
    detail: "需要在 Play Console 中运行和查看。",
  },
  "android-vitals": {
    label: "Android 重要指标",
    detail:
      "用户感知崩溃率高于 1.09% 或 ANR 率高于 0.47% 会降低可见度。仅在 Play Console 中。",
  },
  "preview-video-page": {
    label: "应用预览",
    detail: "审计未从商店页面读取产品媒体，因此不衡量预览视频。",
  },
};

const PATTERNS: ReadonlyArray<
  readonly [RegExp, string | ((whole: string) => string)]
> = [
  [
    /^\d+ of \d+ characters used\.$/,
    (whole) =>
      whole.replace(
        /^(\d+) of (\d+) characters used\.$/,
        "已使用 $1 / $2 个字符。",
      ),
  ],
  [
    /^Readable captions: (\d+) of the first (\d+) screenshots carry a readable caption\.$/,
    "可读说明：前 $2 张截图中有 $1 张带有可读说明。",
  ],
  [/^Visibility is ([\d.]+)\.$/, "可见度为 $1。"],
  [
    /^(\d+) of the first (\d+) screenshots carry a readable caption\.$/,
    "前 $2 张截图中有 $1 张带有可读说明。",
  ],
  [
    /^Search visibility: Visibility is ([\d.]+)\.$/,
    "搜索可见度：可见度为 $1。",
  ],
  [/^(\d+) words repeat the title\.$/, "$1 个词与标题重复。"],
  [/^No keyword field saved\.$/, "尚未保存关键词字段。"],
  [/^No preview video is on the store page\.$/, "商店详情页没有预览视频。"],
  [
    /^The store page shows (\d+) preview videos?\.$/,
    "商店详情页展示了 $1 个预览视频。",
  ],
  [
    /^The store page lists (\d+) in-app events?\.$/,
    "商店详情页列出了 $1 个应用内活动。",
  ],
  [/^No in-app event is on the store page\.$/, "商店详情页没有应用内活动。"],
  [
    /^Submitted (\d+) days? before the publish window\.$/,
    "在发布窗口前 $1 天提交。",
  ],
  [/^A nomination is submitted for featuring\.$/, "已提交精选提名。"],
  [
    /^Promotional text is set for (\d+) of (\d+) localizations\.$/,
    "$1 / $2 个本地化填写了推广文本。",
  ],
  [
    /^Promotional text is set for all (\d+) localizations\.$/,
    "全部 $1 个本地化都填写了推广文本。",
  ],
  [/^Average rating is ([\d.]+)\.$/, "平均评分为 $1。"],
  [/^The last update was (\d+) days ago\.$/, "上次更新是 $1 天前。"],
  [
    /^(\d+) of (\d+) recommended screenshots used\.$/,
    "已使用 $1 / $2 张推荐截图。",
  ],
  [
    /^Readable captions: (\d+) of the first (\d+) screenshots carry a readable caption\.$/,
    "可读说明：前 $2 张截图中有 $1 张带有可读说明。",
  ],
  [
    /^Search visibility: Visibility is ([\d.]+)\.$/,
    "搜索可见度：可见度为 $1。",
  ],
  [/^The icon shows (\S+) elements\.$/, "图标包含 $1 个元素。"],
  [/^A feature graphic is set\.$/, "已设置特色图片。"],
  [/^No feature graphic found\.$/, "未找到特色图片。"],
  [/^A promo video is linked\.$/, "已关联宣传视频。"],
  [/^No promo video linked\.$/, "未关联宣传视频。"],
  [/^No ratings yet\.$/, "尚无评分。"],
  [
    /^The subtitle is indexed right after the title\./,
    "副标题会被紧跟在标题之后索引。",
  ],
  [
    /^Google Play indexes the full description\./,
    "Google Play 会索引完整描述。",
  ],
  [
    /^Only one priority keyword sits outside your title\./,
    "只有一个优先关键词不在标题中。",
  ],
  [/^The app store search results show /, "商店搜索结果显示 "],
  [/^The store page shows /, "商店详情页显示 "],
  [/^The first lines are /, "首行内容是 "],
  [/^A screenshot caption /, "截图说明 "],
  [/^The full description /, "完整描述 "],
  [/^The icon /, "图标 "],
  [/^The keyword field /, "关键词字段 "],
  [/^The subtitle /, "副标题 "],
  [/^The title /, "标题 "],
  [/^Your /, "你的 "],
  [/^Add /, "添加 "],
  [/^Use /, "使用 "],
  [/^Raise /, "提升 "],
  [/^Reply to /, "回复 "],
  [/^Remove /, "移除 "],
  [/^Replace /, "替换 "],
  [/^Cover /, "覆盖 "],
  [/^Write /, "撰写 "],
  [/^Link /, "关联 "],
  [/^Upload /, "上传 "],
];

const LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Add a subtitle$/, "添加副标题"],
  [/^Raise your search visibility$/, "提升搜索可见度"],
  [/^Recover your search visibility$/, "恢复搜索可见度"],
  [/^Add a preview video$/, "添加预览视频"],
  [/^Link a promo video$/, "关联宣传视频"],
  [
    /^Add readable captions to your first screenshots$/,
    "为首张截图添加可读说明",
  ],
  [/^Lead with a benefit in your first screenshot$/, "让首张截图突出优势"],
  [/^Use all \d+ phone screenshot slots$/, "用满所有手机截图位"],
  [/^Use the (\d+) unused title characters$/, "使用标题中剩余的 $1 个字符"],
  [
    /^Use the (\d+) unused short description characters$/,
    "使用简短描述中剩余的 $1 个字符",
  ],
  [
    /^Use the (\d+) unused keyword field characters$/,
    "使用关键词字段中剩余的 $1 个字符",
  ],
  [
    /^Paste your keyword field from App Store Connect$/,
    "从 App Store Connect 粘贴关键词字段",
  ],
  [
    /^Add OPENAI_API_KEY to analyze your icon and screenshots$/,
    "添加 OPENAI_API_KEY 以分析图标和截图",
  ],
  [/^Add competitors to compare titles$/, "添加竞品以对比标题"],
  [/^Add competitors to compare icons$/, "添加竞品以对比图标"],
  [/^Add competitors to find keyword gaps$/, "添加竞品以发现关键词缺口"],
  [
    /^Score your tracked keywords to find your primary keywords$/,
    "为已跟踪关键词评分，找出主关键词",
  ],
  [/^Needs (\d+) days? of position history$/, "需要 $1 天排名历史"],
  [/^Positions appear after the first daily check$/, "首次每日检查后显示排名"],
];

const chinese = (locale: Locale): boolean => locale === "zh-CN";

export function auditFactorLabel(
  id: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (FACTOR_LABEL_ZH[id] ?? fallback) : fallback;
}

export function auditCheckLabel(
  id: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (CHECK_LABEL_ZH[id] ?? fallback) : fallback;
}

export function auditUnlockLabel(
  kind: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (UNLOCK_LABEL_ZH[kind] ?? fallback) : fallback;
}

export function auditBenchmarkLabel(
  metric: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (BENCHMARK_LABEL_ZH[metric] ?? fallback) : fallback;
}

export function auditLimitation(
  limitation: { id: string; label: string; detail: string },
  locale: Locale,
): { label: string; detail: string } {
  if (!chinese(locale)) return limitation;
  const copy = LIMITATION_ZH[limitation.id];
  return (
    copy ?? {
      label: limitation.label,
      detail: auditText(limitation.detail, locale),
    }
  );
}

export function auditReadinessLabel(
  itemId: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (READINESS_LABEL_ZH[itemId] ?? fallback) : fallback;
}

export function auditReadinessLinkLabel(
  href: string,
  fallback: string,
  locale: Locale,
): string {
  return chinese(locale) ? (READINESS_LINK_ZH[href] ?? fallback) : fallback;
}

export function auditText(text: string, locale: Locale): string {
  if (!chinese(locale)) return text;
  const evidence = text.match(/^Evidence for (.+)\.$/);
  if (evidence) {
    return `${CHECK_LABEL_ZH[evidence[1]] ?? evidence[1]}的证据。`;
  }
  const change = text.match(/^Change (.+) the way the rubric describes\.$/);
  if (change) {
    return `按评分规则修复${CHECK_LABEL_ZH[change[1]] ?? change[1]}。`;
  }
  return PATTERNS.reduce(
    (value, [pattern, replacement]) =>
      typeof replacement === "function"
        ? value.replace(pattern, replacement)
        : value.replace(pattern, replacement),
    text,
  );
}

export function auditLabel(label: string, locale: Locale): string {
  if (!chinese(locale)) return label;
  for (const [pattern, replacement] of LABEL_PATTERNS) {
    if (pattern.test(label)) return label.replace(pattern, replacement);
  }
  return auditText(label, locale);
}

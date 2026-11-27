import { describe, expect, it } from "vitest";
import { CHANGE_FIELD_ZH, RULE_ZH } from "@/components/alerts/alert-sentence";
import { loadMessages } from "./messages";

const EXPECTED: Record<string, string> = {
  "charts.visibilityAria": "可见度",
  "dashboard.table.visibility": "可见度",
  "dashboard.cards.blendedVisibility": "综合可见度",
  "metrics.visibility.title": "可见度",
  "overview.metrics.visibility": "可见度",
  "overview.charts.searchVisibilityOverTime": "搜索可见度",
  "appDetail.notices.notInSearchBody": "可见度",
  "actions.evidenceLabels.visibilityBefore": "可见度",
  "changes.timeline.visibility": "可见度",
  "competitors.standing.visibility": "可见度",

  "overview.metrics.shareOfVoice": "声量份额",
  "metrics.shareOfVoice.title": "声量份额",

  "metadata.fields.description": "描述",
  "changes.fields.description": "描述",
  "appDetail.snapshot.fields.description": "描述",

  "metadata.fields.promotionalText": "推广文本",
  "competitors.fields.promotionalText": "推广文本",
  "actions.evidenceFields.promotionalText": "推广文本",

  "appDetail.snapshot.fields.featuring": "精选",
  "changes.fields.featuring": "精选",
  "keywords.changeFields.featuring": "精选",
  "actions.evidenceFields.featuring": "精选",

  "competitors.gaps.opportunity": "机会分",
  "keywords.table.opportunity": "机会分",
  "keywordInspector.discovery.columns.opportunity": "机会分",
  "overview.coverage.opportunity": "机会分",
  "actions.evidenceLabels.opportunity": "机会分",

  "keywords.workspace.listingMarks": "详情页标记",
  "keywords.history.listingChanges": "详情页",
  "overview.charts.listingChange": "详情页",
  "dashboard.charts.listingChange": "详情页",
  "rankings.listingChange": "详情页",
  "keywordInspector.keywordSheet.listing.title": "详情页",

  "overview.funnel.tiles.impressions": "曝光量",
  "overview.funnel.tiles.pageViews": "详情页",
  "overview.funnel.tiles.gets.appStore": "获取点击量",
  "actions.evidenceLabels.getTapsDay": "获取点击量",
  "integrations.storeConnections.appStore.empty": "曝光量",

  "localizations.origin.home": "主版本",
  "localizations.origin.manual": "手动添加",
  "actions.priorities.critical": "紧急",
};

function valueAt(messages: Record<string, unknown>, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (part, key) =>
        part !== null && typeof part === "object"
          ? (part as Record<string, unknown>)[key]
          : undefined,
      messages,
    );
  if (typeof value !== "string") {
    throw new Error(`Missing message at ${path}`);
  }
  return value;
}

describe("Simplified Chinese ASO terminology", () => {
  it("uses the agreed term for each ASO concept", async () => {
    const messages = await loadMessages("zh-CN");
    for (const [path, term] of Object.entries(EXPECTED)) {
      expect(valueAt(messages, path), path).toContain(term);
    }
  });

  it("keeps generated-content maps on the same terms", () => {
    expect(CHANGE_FIELD_ZH.featuring).toBe("精选");
    expect(CHANGE_FIELD_ZH.whatsNew).toBe("更新内容");
    expect(RULE_ZH["keyword.defend"]).toContain("关键词");
  });

  it("keeps impressions distinct from visibility", async () => {
    const messages = await loadMessages("zh-CN");
    const funnel = valueAt(messages, "overview.funnel.tiles.impressions");
    const visibility = valueAt(messages, "overview.metrics.visibility");
    expect(funnel).toBe("曝光量");
    expect(visibility).toBe("可见度");
    expect(funnel).not.toBe(visibility);
  });
});

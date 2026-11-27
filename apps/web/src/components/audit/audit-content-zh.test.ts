import { describe, expect, it } from "vitest";
import {
  auditCheckLabel,
  auditFactorLabel,
  auditLabel,
  auditText,
  auditUnlockLabel,
} from "./audit-content-zh";
import { screenshotSummary } from "./creative-summary";

describe("audit content in Simplified Chinese", () => {
  it("translates factor, check and unlock labels by id", () => {
    expect(auditFactorLabel("keywordField", "Keyword field", "zh-CN")).toBe(
      "关键词字段",
    );
    expect(auditCheckLabel("title-length", "Character usage", "zh-CN")).toBe(
      "字符使用",
    );
    expect(
      auditUnlockLabel(
        "keyword-field",
        "Paste your keyword field from App Store Connect",
        "zh-CN",
      ),
    ).toBe("从 App Store Connect 粘贴关键词字段");
  });

  it("translates generated details and fixes", () => {
    expect(auditText("Evidence for title-length.", "zh-CN")).toBe(
      "字符使用的证据。",
    );
    expect(
      auditText("Change title-length the way the rubric describes.", "zh-CN"),
    ).toBe("按评分规则修复字符使用。");
    expect(auditText("19 of 30 characters used.", "zh-CN")).toBe(
      "已使用 19 / 30 个字符。",
    );
    expect(auditText("Visibility is 27.4.", "zh-CN")).toBe("可见度为 27.4。");
    expect(
      auditText(
        "2 of the first 3 screenshots carry a readable caption.",
        "zh-CN",
      ),
    ).toBe("前 3 张截图中有 2 张带有可读说明。");
  });

  it("translates recommendation labels", () => {
    expect(auditLabel("Add a subtitle", "zh-CN")).toBe("添加副标题");
    expect(auditLabel("Use the 11 unused title characters", "zh-CN")).toBe(
      "使用标题中剩余的 11 个字符",
    );
  });

  it("translates the creative summary", () => {
    const screenshots = [
      {
        position: 1,
        url: "a",
        captionText: "A benefit",
        captionReadable: true,
        captionLanguage: "en",
        message: "benefit" as const,
        keywordHits: ["geo quiz"],
      },
      {
        position: 2,
        url: "b",
        captionText: null,
        captionReadable: false,
        captionLanguage: null,
        message: "other" as const,
        keywordHits: [],
      },
    ];
    expect(screenshotSummary(screenshots, "zh-CN")).toContain(
      "1 / 2 张截图说明可读",
    );
  });

  it("translates generated check details and fixes", () => {
    expect(auditText("No policy or formatting issues found.", "zh-CN")).toBe(
      "未发现商店规则或格式问题。",
    );
    expect(auditText("No competitor titles to compare against.", "zh-CN")).toBe(
      "没有可对比的竞品标题。",
    );
    expect(auditText("App Store Connect analytics only.", "zh-CN")).toBe(
      "仅 App Store Connect 分析数据。",
    );
    expect(
      auditText("Submitted 21 days before the publish window.", "zh-CN"),
    ).toBe("在发布窗口前 21 天提交。");
    expect(
      auditText(
        "You have 341 ratings; the median competitor has 300.",
        "zh-CN",
      ),
    ).toBe("你有 341 条评分；竞品中位数为 300。");
    expect(
      auditText(
        "The title has “geo”, “map” from “geo quiz map”, but not the whole phrase.",
        "zh-CN",
      ),
    ).toContain("没有完整短语");
    expect(
      auditText("Google Play does not allow emoji in the title.", "zh-CN"),
    ).toContain("表情符号");
    expect(auditText("The first screenshot shows a benefit.", "zh-CN")).toBe(
      "首张截图展示了优势。",
    );
    expect(
      auditText(
        "It shows a benefit with “Build better habits.”. Most shoppers never scroll past the third screenshot.",
        "zh-CN",
      ),
    ).toContain("多数用户不会翻过第三张截图");
  });

  it("translates generated recommendation labels", () => {
    expect(auditLabel("Add social proof to your description", "zh-CN")).toBe(
      "在描述中加入社会认同",
    );
    expect(auditLabel("Raise your icon's contrast", "zh-CN")).toBe(
      "提高图标对比度",
    );
    expect(
      auditLabel("Cut your keyword field to 100 characters", "zh-CN"),
    ).toBe("将关键词字段精简到 100 个字符");
  });

  it("keeps English unchanged", () => {
    expect(auditText("19 of 30 characters used.", "en")).toBe(
      "19 of 30 characters used.",
    );
  });
});

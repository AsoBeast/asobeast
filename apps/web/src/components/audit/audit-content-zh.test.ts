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

  it("keeps English unchanged", () => {
    expect(auditText("19 of 30 characters used.", "en")).toBe(
      "19 of 30 characters used.",
    );
  });
});

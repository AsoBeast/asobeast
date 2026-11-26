import { describe, expect, it } from "vitest";
import { RELEASES } from "./releases";
import { localizedRelease } from "./localized-release";

describe("localizedRelease", () => {
  it("translates the language-switch release into Simplified Chinese", () => {
    const release = RELEASES.find((item) => item.version === "2.1.0");
    expect(release).toBeDefined();
    const localized = localizedRelease(release!, "zh-CN");

    expect(localized.title).toBe("选择英文或简体中文");
    expect(localized.summary).toContain("简体中文");
    expect(localized.changes[0]?.title).toBe("每个页面都有语言切换");
  });

  it("translates historical releases into Simplified Chinese", () => {
    const release = RELEASES.find((item) => item.version === "2.0.0");
    expect(release).toBeDefined();
    const localized = localizedRelease(release!, "zh-CN");

    expect(localized.title).toBe("AsoBeast 2");
    expect(localized.summary).toContain("关键词检查器");
    expect(localized.changes[0]?.title).toBe("检查任意关键词");
  });

  it("gives every release a Chinese title and summary", () => {
    for (const release of RELEASES) {
      const localized = localizedRelease(release, "zh-CN");
      expect(localized.title, release.version).toBeTruthy();
      expect(localized.summary, release.version).not.toBe(release.summary);
    }
  });
});

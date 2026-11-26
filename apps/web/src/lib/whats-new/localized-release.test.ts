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

  it("keeps an untranslated historical release unchanged", () => {
    const release = RELEASES.find((item) => item.version === "2.0.0");
    expect(release).toBeDefined();
    expect(localizedRelease(release!, "zh-CN")).toBe(release);
  });
});

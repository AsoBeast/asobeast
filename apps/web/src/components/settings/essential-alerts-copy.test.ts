import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import { essentialNeed, essentialNeedCopy } from "./essential-alerts-copy";

const en = translationContext("en", "notifications").translator;
const zh = translationContext("zh-CN", "notifications").translator;

describe("essentialNeedCopy", () => {
  it("says what turns the essential alerts on", () => {
    expect(essentialNeedCopy("smtp", en)).toBe(
      "Once email works, AsoBeast turns on the essential alerts for a new workspace after its first daily run.",
    );
    expect(essentialNeedCopy("https", en)).toBe(
      "AsoBeast turns on the essential alerts after your first daily run once WEB_PUBLIC_URL is an https address.",
    );
  });

  it("localizes the setup guidance and preserves the variable name", () => {
    expect(essentialNeedCopy("smtp", zh)).toBe(
      "邮件功能可用后，AsoBeast 会在新工作区完成首次每日运行后开启必要提醒。",
    );
    expect(essentialNeedCopy("https", zh)).toBe(
      "首次每日运行完成后，只要 WEB_PUBLIC_URL 是 https 地址，AsoBeast 就会开启必要提醒。",
    );
  });

  it("returns a rich-message descriptor for the environment variable", () => {
    expect(essentialNeed("https")).toEqual({
      key: "essential.needHttps",
      values: {},
    });
  });

  it("says nothing when nothing is missing", () => {
    expect(essentialNeedCopy(null, en)).toBeNull();
    expect(essentialNeedCopy(undefined, en)).toBeNull();
    expect(essentialNeed(null)).toBeNull();
    expect(essentialNeed(undefined)).toBeNull();
  });
});

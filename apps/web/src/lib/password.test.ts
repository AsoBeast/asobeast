import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import enAuth from "../../messages/en/auth.json";
import zhAuth from "../../messages/zh-CN/auth.json";
import { passwordError, passwordHint } from "./password";

function translator(locale: "en" | "zh-CN") {
  return createTranslator({
    locale,
    namespace: "auth",
    messages: { auth: locale === "en" ? enAuth : zhAuth },
    timeZone: "UTC",
  });
}

describe("passwordError", () => {
  it("translates the shared password hint", () => {
    expect(passwordHint(translator("en"))).toBe("At least 10 characters.");
    expect(passwordHint(translator("zh-CN"))).toBe("至少 10 个字符。");
  });

  it("accepts a password that meets the rule", () => {
    expect(passwordError("correct horse", translator("en"))).toBeNull();
  });

  it("asks for more characters when the password is too short", () => {
    expect(passwordError("short", translator("en"))).toBe(
      "Use at least 10 characters.",
    );
  });

  it("asks for fewer characters when the password is too long", () => {
    expect(passwordError("a".repeat(129), translator("en"))).toBe(
      "Use 128 characters or fewer.",
    );
  });

  it.each([" ".repeat(10), "a         b"])(
    "says spaces do not count for %j",
    (password) => {
      expect(passwordError(password, translator("en"))).toBe(
        "Use at least 10 characters, not counting spaces.",
      );
    },
  );

  it("translates every password validation outcome into Chinese", () => {
    const t = translator("zh-CN");

    expect(passwordError("short", t)).toBe("请至少使用 10 个字符。");
    expect(passwordError("a".repeat(129), t)).toBe("请最多使用 128 个字符。");
    expect(passwordError(" ".repeat(10), t)).toBe(
      "请至少使用 10 个字符（不计空格）。",
    );
  });
});

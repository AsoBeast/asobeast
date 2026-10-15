import { describe, expect, it } from "vitest";
import { replyLanguageName } from "./reply-language";

describe("replyLanguageName", () => {
  it("names a language from its tag and region", () => {
    expect(replyLanguageName("en")).toBe("English");
    expect(replyLanguageName("de-DE")).toBe("German");
    expect(replyLanguageName("pt_BR")).toBe("Portuguese");
  });

  it("falls back to the tag itself", () => {
    expect(replyLanguageName("tlh")).toBe("tlh");
    expect(replyLanguageName("und")).toBe("und");
  });
});

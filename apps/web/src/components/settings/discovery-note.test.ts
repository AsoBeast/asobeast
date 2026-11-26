import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import { discoveryNote } from "./discovery-note";

const en = translationContext("en", "settings").translator;
const zh = translationContext("zh-CN", "settings").translator;

describe("discoveryNote", () => {
  it("says nothing without weekly discovery", () => {
    expect(discoveryNote(undefined, en)).toBeNull();
    expect(
      discoveryNote({ checksPerWeek: 0, requestsPerWeek: 0 }, en),
    ).toBeNull();
  });

  it("names the weekly searches and requests", () => {
    expect(discoveryNote({ checksPerWeek: 80, requestsPerWeek: 240 }, en)).toBe(
      "Keyword discovery adds up to 80 searches a week, about 240 requests, outside this daily total.",
    );
    expect(
      discoveryNote({ checksPerWeek: 1200, requestsPerWeek: 4800 }, en),
    ).toBe(
      "Keyword discovery adds up to 1,200 searches a week, about 4,800 requests, outside this daily total.",
    );
  });

  it("names a single search and request", () => {
    expect(discoveryNote({ checksPerWeek: 1, requestsPerWeek: 1 }, en)).toBe(
      "Keyword discovery adds up to 1 search a week, about 1 request, outside this daily total.",
    );
  });

  it("localizes weekly discovery counts in Chinese", () => {
    expect(discoveryNote({ checksPerWeek: 80, requestsPerWeek: 240 }, zh)).toBe(
      "关键词发现每周最多增加 80 次搜索、约 240 次请求，不计入此每日总量。",
    );
  });
});

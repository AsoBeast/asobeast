import { describe, expect, it } from "vitest";
import type {
  KeywordImportSummary,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import { noSearchTermsFact } from "@/lib/funnel";
import { insightDetail } from "@/lib/keyword-insights";
import {
  fileNotices,
  importButtonLabel,
  importToast,
  rowNote,
} from "@/lib/keyword-import";
import { movesSentence } from "@/lib/keyword-day-change";
import { additionNotice } from "@/lib/keyword-field-addition";
import { bulkReport } from "@/lib/keyword-bulk";
import { trendLabel } from "@/lib/trend-window";
import { wastedWordLine } from "@/lib/wasted-words";
import { keywordTableCaption } from "./keyword-caption";
import { keywordCsv } from "./keyword-csv";

const zh = translationContext("zh-CN", "keywords").translator;

const summary = (
  parts: Partial<KeywordImportSummary>,
): KeywordImportSummary => ({
  rows: 0,
  new: 0,
  resume: 0,
  tracked: 0,
  duplicate: 0,
  invalid: 0,
  overQuota: 0,
  ...parts,
});

const keyword = (
  fields: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: "kw-1",
  text: "focus timer",
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: 12,
  latestDepth: 200,
  previousPosition: 9,
  positionDelta1d: -3,
  positionDelta7d: null,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...fields,
});

describe("Simplified Chinese keyword copy helpers", () => {
  it("uses ICU plurals for import buttons, notices, and toasts", () => {
    expect(importButtonLabel(summary({ new: 1 }), zh)).toBe("导入 1 个关键词");
    expect(importButtonLabel(summary({ new: 2, resume: 1 }), zh)).toBe(
      "导入 3 个关键词",
    );
    expect(
      fileNotices(
        {
          fallback: false,
          hasHeader: true,
          ignoredColumns: 2,
          skippedRows: 1,
        },
        zh,
      ),
    ).toEqual(["表头上方有 1 行被跳过。", "已忽略 2 个其他列。"]);
    expect(
      importToast(
        { imported: 2, summary: summary({ rows: 3, new: 2, tracked: 1 }) },
        undefined,
        zh,
      ),
    ).toEqual({
      title: "正在跟踪 2 个关键词",
      description: "已跳过 1 行。排名将在下次运行时采集。",
    });
  });

  it("preserves API row errors while localizing import status notes", () => {
    expect(
      rowNote(
        {
          index: 0,
          keyword: "focus timer",
          country: "us",
          status: "invalid",
          message: "Keyword must not be empty",
        },
        [2],
        zh,
      ),
    ).toBe("Keyword must not be empty");
    expect(
      rowNote(
        {
          index: 1,
          keyword: "focus timer",
          country: "us",
          status: "duplicate",
          duplicateOf: 0,
        },
        [2, 7],
        zh,
      ),
    ).toBe("重复第 2 行");
  });

  it("localizes insight details, movement summaries, and bulk outcomes", () => {
    expect(insightDetail(keyword({ dropStreak: 3 }), "dropping", zh)).toBe(
      "连续 3 次检查排名下降",
    );
    expect(
      movesSentence(
        { compared: 3, up: 1, down: 2, lost: 0, entered: 0 },
        zh,
        "zh-CN",
      ),
    ).toBe("1 个上升和2 个下降，均较昨日。");
    expect(
      bulkReport(
        "pause",
        { changed: 2, unchanged: 1, missing: 0, notSent: 0 },
        3,
        zh,
      ).message,
    ).toBe("已暂停 2 个关键词，1 个已暂停");
  });

  it("localizes keyword field, table, trend, and wasted-word copy", () => {
    expect(
      additionNotice({ added: [], held: [], leftOut: 2 }, "英语", zh),
    ).toBe("2 个关键词无法放入 英语 关键词字段，已被排除。");
    expect(
      keywordTableCaption(
        {
          added: false,
          playInstalls: false,
          competitors: false,
          insights: false,
          totals: true,
        },
        zh,
        "zh-CN",
      ),
    ).toContain("跟踪的关键词");
    expect(trendLabel("30d", zh)).toBe("最近 30 天");
    expect(
      wastedWordLine(
        { word: "tracker", localizations: ["en-US", "es-MX"] },
        zh,
        "zh-CN",
      ),
    ).toContain("“tracker”位于");
  });

  it("localizes CSV prose while preserving keyword, tag, and note values", () => {
    const csv = keywordCsv(
      [
        keyword({
          dropStreak: 3,
          tags: ["core"],
          note: "Keep me",
        }),
      ],
      "2026-11-25",
      zh,
    );

    expect(csv).toContain("focus timer");
    expect(csv).toContain("core");
    expect(csv).toContain("Keep me");
    expect(csv).toContain("排名下降");
    expect(csv).toContain(
      "Apple App Store 和 Google Play 的热度及搜索量评分使用不同的公开信号，不能直接比较",
    );
  });

  it("passes the Chinese overview translator into the no-search-terms handoff", () => {
    const overview = translationContext("zh-CN", "overview");
    expect(noSearchTermsFact("2026-11", overview)).toBe(
      "Google Play Console 的 2026年11月报告未列出此应用的搜索词。",
    );
  });
});

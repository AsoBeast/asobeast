import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TestIntlProvider } from "@/test/intl-provider";
import { translationContext } from "@/test/translation-context";
import { MapZoneLegend, MapZoneTable } from "./MapZoneLegend";
import { ThresholdsPopover } from "./ThresholdsPopover";

vi.mock("@/components/ui/popover", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/popover")>();
  return {
    ...actual,
    Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const thresholds = { popularity: 20, difficulty: 25 };
const counts = {
  zones: { quickWins: 3, worthFighting: 2, easyPickings: 1, lowPriority: 4 },
  unplotted: 2,
};

describe("Simplified Chinese opportunity map controls", () => {
  it("localizes threshold labels, reset and the quick wins rule", () => {
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <ThresholdsPopover />
      </TestIntlProvider>,
    );

    for (const text of [
      "阈值",
      "区域阈值",
      "这两个数字将地图划分为不同区域。设置保存在此浏览器中。",
      "重置",
      "热度至少",
      "难度至多",
      "快速取胜是热度至少为 20，且难度至多为 25。",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain("Zone thresholds");
    expect(markup).not.toContain("Popularity at least");
    expect(
      translationContext("zh-CN", "keywordInspector").translator(
        "thresholds.invalid",
        { min: 0, max: 100 },
      ),
    ).toBe("请输入 0 到 100 之间的整数");
  });

  it("localizes zone names, counts and accessible table copy", () => {
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <>
          <MapZoneLegend
            counts={counts}
            thresholds={thresholds}
            selected="quickWins"
            onToggle={() => undefined}
          />
          <MapZoneTable counts={counts} thresholds={thresholds} />
        </>
      </TestIntlProvider>,
    );

    for (const text of [
      "快速取胜 3 个关键词",
      "值得争取 2 个关键词",
      "轻易获得 1 个关键词",
      "低优先级 4 个关键词",
      "关于快速取胜",
      "阅读机会地图",
      "机会地图区域",
      "未在地图上",
      "缺少热度或难度",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain("Quick wins");
    expect(markup).not.toContain("Opportunity map zones");
  });
});

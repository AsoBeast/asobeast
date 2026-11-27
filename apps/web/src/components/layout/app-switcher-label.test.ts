import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { AppListItem } from "@asobeast/shared";
import zhShell from "../../../messages/zh-CN/shell.json";
import { switcherSubtitle } from "./app-switcher-label";

const APPS = [{ id: "app-1" }, { id: "app-2" }] as AppListItem[];

describe("switcherSubtitle", () => {
  it("counts a list that was read", () => {
    expect(switcherSubtitle(APPS, false)).toBe("2 tracked");
  });

  it("counts a list that was read and is empty as zero", () => {
    expect(switcherSubtitle([], false)).toBe("0 tracked");
  });

  it("keeps the count of a list whose later refresh failed", () => {
    expect(switcherSubtitle(APPS, true)).toBe("2 tracked");
  });

  it("says the list could not be loaded when no list was read and the read failed", () => {
    expect(switcherSubtitle(undefined, true)).toBe("Could not load apps");
  });

  it("says the list is loading while no list was read and nothing failed", () => {
    expect(switcherSubtitle(undefined, false)).toBe("Loading apps…");
  });

  it("translates the tracked count and read states", () => {
    const translator = createTranslator({
      locale: "zh-CN",
      namespace: "shell",
      messages: { shell: zhShell },
      timeZone: "UTC",
    });
    const context = { translator, locale: "zh-CN" as const };

    expect(switcherSubtitle(APPS, false, context)).toBe("已跟踪 2 个");
    expect(switcherSubtitle(undefined, true, context)).toBe("无法加载应用");
    expect(switcherSubtitle(undefined, false, context)).toBe("正在加载应用…");
  });
});

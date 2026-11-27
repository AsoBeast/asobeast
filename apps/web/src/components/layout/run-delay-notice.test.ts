import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { WorkspaceRunStatus } from "@asobeast/shared";
import zhSystemNotices from "../../../messages/zh-CN/systemNotices.json";
import { runDelayNotice } from "./run-delay-notice";

function statusOf(
  overrides: Partial<WorkspaceRunStatus> = {},
): WorkspaceRunStatus {
  return {
    state: "delayed",
    startedAt: "2026-08-14T03:00:00.000Z",
    lastCaptureAt: "2026-08-14T04:00:00.000Z",
    tracked: 100,
    captured: 40,
    stores: [
      { store: "APP_STORE", tracked: 50, captured: 50 },
      { store: "GOOGLE_PLAY", tracked: 50, captured: 0 },
    ],
    ...overrides,
  };
}

describe("runDelayNotice", () => {
  it("translates delayed run progress for Simplified Chinese", () => {
    const translator = createTranslator({
      locale: "zh-CN",
      namespace: "systemNotices",
      messages: { systemNotices: zhSystemNotices },
      timeZone: "UTC",
    });
    const notice = runDelayNotice(statusOf(), {
      translator,
      locale: "zh-CN",
    });

    expect(notice?.title).toBe("你的 Google Play 应用排名更新延迟");
    expect(notice?.detail).toContain("已采集 100 个被跟踪关键词中的 40 个");
  });

  it("says nothing while the run is on time", () => {
    expect(runDelayNotice(statusOf({ state: "running" }))).toBeNull();
    expect(runDelayNotice(statusOf({ state: "complete" }))).toBeNull();
    expect(runDelayNotice(statusOf({ state: "idle" }))).toBeNull();
  });

  it("names only the store that is behind", () => {
    expect(runDelayNotice(statusOf())?.title).toBe(
      "Rankings for your Google Play apps are delayed",
    );
  });

  it("falls back to a plain title when every store is behind", () => {
    const notice = runDelayNotice(
      statusOf({
        stores: [
          { store: "APP_STORE", tracked: 50, captured: 1 },
          { store: "GOOGLE_PLAY", tracked: 50, captured: 0 },
        ],
      }),
    );

    expect(notice?.title).toBe("Today's rankings are delayed");
  });

  it("says how far the run got without claiming data is lost", () => {
    const notice = runDelayNotice(statusOf());

    expect(notice?.detail).toContain("40 of 100");
    expect(notice?.detail).toContain("may be from yesterday");
  });

  it("explains a run that captured nothing at all", () => {
    const notice = runDelayNotice(
      statusOf({
        captured: 0,
        stores: [{ store: "APP_STORE", tracked: 50, captured: 0 }],
      }),
    );

    expect(notice?.detail).toContain("stored history is unchanged");
  });
});

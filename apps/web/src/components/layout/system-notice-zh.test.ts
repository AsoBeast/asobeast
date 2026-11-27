import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { StoreHealthReport, WorkspaceRunStatus } from "@asobeast/shared";
import zhSystemNotices from "../../../messages/zh-CN/systemNotices.json";
import { systemNotice } from "./system-notice";

const ON_TIME: WorkspaceRunStatus = {
  state: "complete",
  startedAt: "2026-08-28T03:00:00.000Z",
  lastCaptureAt: "2026-08-28T04:00:00.000Z",
  tracked: 100,
  captured: 100,
  stores: [
    { store: "APP_STORE", tracked: 50, captured: 50 },
    { store: "GOOGLE_PLAY", tracked: 50, captured: 50 },
  ],
};

function health(state: "ok" | "broken"): StoreHealthReport {
  return {
    stores: [
      {
        store: "GOOGLE_PLAY",
        state,
        source: "canary",
        since: "2026-08-28T02:00:00.000Z",
        checkedAt: "2026-08-28T08:00:00.000Z",
        detail: null,
      },
    ],
    degraded: state === "broken",
  };
}

describe("Simplified Chinese system notices", () => {
  it("translates store breakage and scheduled deletion notices", () => {
    const translator = createTranslator({
      locale: "zh-CN",
      namespace: "systemNotices",
      messages: { systemNotices: zhSystemNotices },
      timeZone: "UTC",
    });
    const context = { translator, locale: "zh-CN" as const };

    expect(
      systemNotice({ stores: health("broken"), run: ON_TIME }, context),
    ).toMatchObject({
      title: "Google Play 的解析似乎已损坏",
      linkLabel: "接下来会发生什么",
    });
    expect(
      systemNotice(
        {
          stores: health("ok"),
          run: ON_TIME,
          deletion: {
            scheduled: true,
            requestedAt: "2026-08-28T09:00:00.000Z",
            requestedBy: "owner@example.com",
            dueAt: "2026-09-04T09:00:00.000Z",
            graceDays: 7,
          },
        },
        context,
      )?.detail,
    ).toContain("2026年9月4日 09:00 UTC");
  });
});

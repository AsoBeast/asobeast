import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import zhActions from "../../../messages/zh-CN/actions.json";
import { actionStatusTag } from "./action-status-tag";
import { actionItem } from "./action-test-item";

const healthy = { degraded: false } as const;

const zh = createTranslator({
  locale: "zh-CN",
  namespace: "actions",
  messages: { actions: zhActions },
});

describe("actionStatusTag", () => {
  it("names a snooze with its wake date", () => {
    expect(
      actionStatusTag(
        actionItem({
          ...healthy,
          status: "SNOOZED",
          snoozedUntil: "2026-08-15T00:00:00.000Z",
        }),
      ),
    ).toEqual({ label: "Snoozed until Aug 15, 2026", tone: "neutral" });
  });

  it("tells verifying, still detected and confirmed apart for a done action", () => {
    const done = {
      ...healthy,
      status: "DONE",
      closedAt: "2026-07-29T08:00:00.000Z",
    } as const;

    expect(
      actionStatusTag(
        actionItem({ ...done, lastSeenAt: "2026-07-28T03:00:00.000Z" }),
      )?.label,
    ).toBe("Verifying");
    expect(
      actionStatusTag(
        actionItem({ ...done, lastSeenAt: "2026-07-30T03:00:00.000Z" }),
      )?.label,
    ).toBe("Still detected");
    expect(
      actionStatusTag(
        actionItem({ ...done, verifiedAt: "2026-07-30T03:00:00.000Z" }),
      ),
    ).toEqual({ label: "Confirmed fixed", tone: "success" });
  });

  it("counts reopenings, and says when a rule stopped on its own", () => {
    expect(
      actionStatusTag(actionItem({ ...healthy, reopenCount: 2 }))?.label,
    ).toBe("Reopened 2×");
    expect(
      actionStatusTag(actionItem({ ...healthy, status: "RESOLVED" }))?.label,
    ).toBe("Resolved on its own");
    expect(actionStatusTag(actionItem(healthy))).toBeNull();
  });

  it("flags evidence that can no longer be read", () => {
    expect(actionStatusTag(actionItem())?.label).toBe("Evidence unavailable");
  });

  it("writes status tags and their dates in Simplified Chinese", () => {
    expect(
      actionStatusTag(
        actionItem({
          ...healthy,
          status: "SNOOZED",
          snoozedUntil: "2026-08-15T00:00:00.000Z",
        }),
        zh,
        "zh-CN",
      )?.label,
    ).toBe("稍后处理至 2026年8月15日");
    expect(
      actionStatusTag(actionItem({ ...healthy, reopenCount: 2 }), zh, "zh-CN")
        ?.label,
    ).toBe("已重新打开 2 次");
  });
});

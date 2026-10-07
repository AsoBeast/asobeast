import { ACTION_DISMISS_REASONS, type ActionEventItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ACTION_DISMISS_REASON_LABEL, historyEntries } from "./action-history";

const event = (overrides: Partial<ActionEventItem>): ActionEventItem => ({
  id: "ev",
  type: "opened",
  actor: "system",
  actorName: null,
  occurredAt: "2026-07-20T03:00:00.000Z",
  status: "OPEN",
  priority: "high",
  impact: 71,
  snoozedUntil: null,
  reason: null,
  ...overrides,
});

describe("historyEntries", () => {
  it("lists the newest change first", () => {
    const entries = historyEntries([
      event({ id: "a" }),
      event({ id: "b", type: "done", actor: "user", actorName: "Anna" }),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("names the wake date of a snooze", () => {
    const [snooze] = historyEntries([
      event({
        type: "snoozed",
        actor: "user",
        snoozedUntil: "2026-08-15T00:00:00.000Z",
      }),
    ]);

    expect(snooze).toMatchObject({
      label: "Snoozed",
      detail: "until Aug 15, 2026",
    });
  });

  it("names the reason of a dismissal", () => {
    const [dismissal] = historyEntries([
      event({ type: "dismissed", actor: "user", reason: "handled_elsewhere" }),
    ]);

    expect(dismissal.detail).toBe("Already handled elsewhere");
  });

  it("credits system changes to asobeast and user changes to the person", () => {
    const [done, opened] = historyEntries([
      event({ id: "a" }),
      event({ id: "b", type: "done", actor: "user", actorName: "Anna" }),
    ]);

    expect(opened).toMatchObject({
      actor: "AsoBeast",
      detail: "High · impact 71",
    });
    expect(done.actor).toBe("Anna");
  });

  it("falls back to a teammate when the person has no name", () => {
    const [done] = historyEntries([
      event({ type: "done", actor: "user", actorName: null }),
    ]);

    expect(done.actor).toBe("A teammate");
  });
});

describe("ACTION_DISMISS_REASON_LABEL", () => {
  it("labels every reason in the shared order", () => {
    expect(Object.keys(ACTION_DISMISS_REASON_LABEL)).toEqual([
      ...ACTION_DISMISS_REASONS,
    ]);
  });
});

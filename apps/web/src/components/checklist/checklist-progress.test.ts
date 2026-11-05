import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  nextItemId,
  pillLabel,
  pillVisible,
  progressAnnouncement,
  ringFraction,
} from "./checklist-progress";

const item = (
  id: WorkspaceChecklistItem["id"],
  done: boolean,
): WorkspaceChecklistItem => ({ id, title: id, done, appId: null });

const checklist = (
  overrides: Partial<WorkspaceChecklist> = {},
): WorkspaceChecklist => ({
  goal: null,
  dismissedAt: null,
  items: [item("import_app", true), item("add_competitor", false)],
  done: 1,
  total: 2,
  ...overrides,
});

describe("pillVisible", () => {
  it("shows an unfinished checklist nobody hid", () => {
    expect(pillVisible(checklist())).toBe(true);
  });

  it("hides a finished checklist", () => {
    expect(pillVisible(checklist({ done: 2 }))).toBe(false);
  });

  it("hides a dismissed checklist", () => {
    expect(
      pillVisible(checklist({ dismissedAt: "2026-11-01T00:00:00.000Z" })),
    ).toBe(false);
  });

  it("hides a checklist with nothing to do", () => {
    expect(pillVisible(checklist({ items: [], done: 0, total: 0 }))).toBe(
      false,
    );
  });
});

describe("pillLabel", () => {
  it("counts the done items of the total", () => {
    expect(pillLabel(2, 8)).toBe("2 of 8 done");
  });
});

describe("progressAnnouncement", () => {
  it("announces nothing on the first render", () => {
    expect(progressAnnouncement(null, { done: 2, total: 8 })).toBeNull();
  });

  it("announces nothing when the progress did not change", () => {
    expect(
      progressAnnouncement({ done: 2, total: 8 }, { done: 2, total: 8 }),
    ).toBeNull();
  });

  it("announces a new done item", () => {
    expect(
      progressAnnouncement({ done: 2, total: 8 }, { done: 3, total: 8 }),
    ).toBe("Setup checklist: 3 of 8 done");
  });

  it("announces a total that moved", () => {
    expect(
      progressAnnouncement({ done: 1, total: 8 }, { done: 1, total: 7 }),
    ).toBe("Setup checklist: 1 of 7 done");
  });
});

describe("nextItemId", () => {
  it("names the first open item", () => {
    expect(nextItemId(checklist().items)).toBe("add_competitor");
  });

  it("names nothing when every item is done", () => {
    expect(nextItemId([item("import_app", true)])).toBeNull();
  });
});

describe("ringFraction", () => {
  it("is the share of done items", () => {
    expect(ringFraction(2, 8)).toBe(0.25);
  });

  it("is empty for an empty checklist", () => {
    expect(ringFraction(0, 0)).toBe(0);
  });
});

import type { AppSetupSummary } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { setupChipText } from "./setup-chip";

const summary = (status: AppSetupSummary["status"]): AppSetupSummary => ({
  status,
  updatedAt: "2026-10-14T09:00:00.000Z",
  done: 2,
  total: 3,
  next: "countries",
});

describe("setupChipText", () => {
  it("counts the settled steps of a setup in progress", () => {
    expect(setupChipText(summary("in_progress"))).toBe("Setup 2 of 3");
  });

  it.each(["not_started", "completed", "dismissed"] as const)(
    "shows nothing for a %s setup",
    (status) => {
      expect(setupChipText(summary(status))).toBeNull();
    },
  );

  it("shows nothing when the api answers no summary", () => {
    expect(setupChipText(undefined)).toBeNull();
  });
});

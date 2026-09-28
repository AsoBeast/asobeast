import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import { noteRequest } from "./note-request";

describe("noteRequest", () => {
  it("resends the current status so only the note changes", () => {
    expect(noteRequest(actionItem({ status: "DONE" }), "shipped")).toEqual({
      status: "DONE",
      note: "shipped",
    });
  });

  it("resends the wake date of a snoozed action", () => {
    expect(
      noteRequest(
        actionItem({
          status: "SNOOZED",
          snoozedUntil: "2026-08-15T00:00:00.000Z",
        }),
        "after the launch",
      ),
    ).toEqual({
      status: "SNOOZED",
      snoozedUntil: "2026-08-15T00:00:00.000Z",
      note: "after the launch",
    });
  });

  it("cannot write a note on a resolved action", () => {
    expect(noteRequest(actionItem({ status: "RESOLVED" }), "late")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  editorKeyOf,
  handoffGenerationsOf,
  nextHandoffGenerations,
} from "./handoff-generations";

describe("editorKeyOf", () => {
  it("keeps the stored key for a localization never handed over", () => {
    expect(editorKeyOf(handoffGenerationsOf(null), "en-US")).toBe("stored");
  });

  it("gives a handed localization a new key on each hand off", () => {
    const first = handoffGenerationsOf("en-US");
    const settled = nextHandoffGenerations(first, null);
    const second = nextHandoffGenerations(settled, "en-US");

    expect(editorKeyOf(first, "en-US")).toBe("handoff-1");
    expect(editorKeyOf(settled, "en-US")).toBe("handoff-1");
    expect(editorKeyOf(second, "en-US")).toBe("handoff-2");
  });

  it("keeps the key of an earlier handed localization when another is handed over", () => {
    const first = handoffGenerationsOf("en-US");
    const settled = nextHandoffGenerations(first, null);
    const other = nextHandoffGenerations(settled, "de");

    expect(editorKeyOf(other, "en-US")).toBe("handoff-1");
    expect(editorKeyOf(other, "de")).toBe("handoff-1");
  });
});

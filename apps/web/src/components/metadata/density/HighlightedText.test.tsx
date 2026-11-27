import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HighlightedText } from "./HighlightedText";

describe("HighlightedText", () => {
  it("marks each run with a line under the tint, so it shows in both themes", () => {
    const markup = renderToStaticMarkup(
      <HighlightedText text="Plan a planner, plan." row="plan" />,
    );

    const marks = markup.match(/<mark class="([^"]+)">/g) ?? [];
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark).toContain("bg-brand-subtle");
      expect(mark).toContain("decoration-brand-mark");
      expect(mark).toContain("decoration-2");
    }
  });
});

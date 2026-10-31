import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchedText } from "./MatchedText";

describe("MatchedText", () => {
  it("marks the exact and folded runs, the folded one dotted and named", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[
          { text: "Focus", match: "exact" },
          { text: " ", match: "none" },
          { text: "Timér", match: "folded" },
        ]}
      />,
    );

    const marks = markup.split("<mark").slice(1);
    expect(marks).toHaveLength(2);
    expect(marks[0]).not.toContain("decoration-dotted");
    expect(marks[1]).toContain("decoration-dotted");
    expect(marks[1]).toContain(
      '<span class="sr-only"> (accents differ)</span>',
    );
  });

  it.each([[[]], [null]])(
    "renders the fallback without marks for %j",
    (segments) => {
      const markup = renderToStaticMarkup(
        <MatchedText segments={segments} fallback="Focus Timer" />,
      );

      expect(markup).toBe("Focus Timer");
    },
  );
});

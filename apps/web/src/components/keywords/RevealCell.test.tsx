import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevealCell } from "./keyword-cells";

describe("RevealCell", () => {
  it("exposes the unavailable state as text, not as an aria-label on a generic span", () => {
    const html = renderToStaticMarkup(<RevealCell label={null} />);

    expect(html).toContain("Reveal: not available");
    expect(html).not.toContain('aria-label="Reveal: not available"');
  });

  it("renders a real label as visible text", () => {
    const html = renderToStaticMarkup(<RevealCell label="3 letters · #2" />);

    expect(html).toContain(">3 letters · #2</span>");
    expect(html).not.toContain("Reveal: not available");
  });
});

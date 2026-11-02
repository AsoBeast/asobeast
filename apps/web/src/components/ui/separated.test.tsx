import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Separated } from "./separated";

describe("Separated", () => {
  it("puts each text part in a span of its own beside the separators", () => {
    const markup = renderToString(
      <p>
        <Separated parts={["3 open", <strong key="c">1 critical</strong>, 2]} />
      </p>,
    );

    expect(markup).toBe(
      '<p><span>3 open</span><span aria-hidden="true"> · </span><strong>1 critical</strong><span aria-hidden="true"> · </span><span>2</span></p>',
    );
  });
});

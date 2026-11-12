import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DayChange } from "@/lib/keyword-day-change";
import { DayChangeCell } from "./DayChangeCell";

const render = (change: DayChange | null, muted = false) =>
  renderToStaticMarkup(<DayChangeCell change={change} muted={muted} />);

describe("DayChangeCell", () => {
  it("names a rank that vanished as lost, in the falling colour", () => {
    const markup = render({ kind: "lost" });

    expect(markup).toContain(">Lost<");
    expect(markup).toContain("Dropped out of the results since yesterday");
    expect(markup).toContain("text-signal-down");
  });

  it("names a keyword that entered the results as new, in the climbing colour", () => {
    const markup = render({ kind: "entered" });

    expect(markup).toContain(">New<");
    expect(markup).toContain("Entered the results since yesterday");
    expect(markup).toContain("text-signal-up");
  });

  it("draws a move as a pill that says its direction", () => {
    expect(render({ kind: "moved", places: 3 })).toContain(
      'aria-label="down 3 since yesterday"',
    );
    expect(render({ kind: "moved", places: -2 })).toContain(
      'aria-label="up 2 since yesterday"',
    );
    expect(render({ kind: "moved", places: 3 })).toContain(
      'data-slot="delta-pill"',
    );
  });

  it("draws no pill around a keyword that held its place", () => {
    const markup = render({ kind: "steady" });

    expect(markup).toContain(">0<");
    expect(markup).not.toContain("delta-pill");
  });

  it("explains its dash", () => {
    expect(render(null)).toContain("No change since yesterday to show");
  });

  it.each<DayChange>([{ kind: "lost" }, { kind: "moved", places: 3 }])(
    "takes the colour out of a paused row (%o)",
    (change) => {
      const markup = render(change, true);

      expect(markup).toContain("text-muted-foreground");
      expect(markup).not.toContain("text-signal-down");
      expect(markup).not.toContain("bg-signal-down-subtle");
    },
  );
});

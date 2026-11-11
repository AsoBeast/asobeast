import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GRADES, type Grade } from "@/lib/grade";
import { GradedNumber } from "./graded";

function markerClasses(grade: Grade | null): string | null {
  const html = renderToString(
    <GradedNumber value="42" grade={grade} label="Difficulty" />,
  );
  const marker = /<span[^>]*data-slot="grade-marker"[^>]*>/.exec(html)?.[0];
  return marker ? (/class="([^"]*)"/.exec(marker)?.[1] ?? "") : null;
}

const shapeOf = (classes: string) =>
  classes
    .split(" ")
    .filter((name) => !name.includes("grade-"))
    .sort()
    .join(" ");

describe("the grade marker", () => {
  it("marks every grade but fair", () => {
    const marked = GRADES.filter((grade) => markerClasses(grade) !== null);
    expect(marked).toEqual(["strong", "weak", "poor"]);
    expect(markerClasses(null)).toBeNull();
  });

  it("gives each marked grade a shape of its own, whatever its colour", () => {
    const shapes = (["strong", "weak", "poor"] as const).map((grade) =>
      shapeOf(markerClasses(grade) ?? ""),
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

import { describe, expect, it } from "vitest";
import type { AppAnnotationItem } from "@asobeast/shared";
import {
  annotationLines,
  annotationsInScope,
  annotationsInMarkets,
  annotationsOn,
} from "./annotation-lines";

const annotation = (
  overrides: Partial<AppAnnotationItem> = {},
): AppAnnotationItem => ({
  id: "ann-1",
  appId: "app-1",
  date: "2026-10-08",
  label: "Release 5.21.0",
  market: null,
  tag: null,
  createdAt: "2026-10-08T09:00:00.000Z",
  ...overrides,
});

describe("annotationLines", () => {
  const plotted = ["2026-10-06", "2026-10-08", "2026-10-10"];

  it("keeps annotations that fall on a plotted day", () => {
    const lines = annotationLines(
      [
        annotation(),
        annotation({ id: "ann-2", date: "2026-10-09" }),
        annotation({ id: "ann-3", date: "2026-10-10" }),
      ],
      plotted,
      "2026-10-12",
    );

    expect(lines.map((line) => line.id)).toEqual(["ann-1", "ann-3"]);
  });

  it("drops the annotation pinned to today, which the axis cannot place", () => {
    const lines = annotationLines(
      [annotation({ date: "2026-10-12" })],
      [...plotted, "2026-10-12"],
      "2026-10-12",
    );

    expect(lines).toEqual([]);
  });
});

describe("annotationsOn", () => {
  const day = annotation();
  const other = annotation({ id: "ann-2", date: "2026-10-09" });

  it("keeps every annotation pinned to the hovered day", () => {
    expect(annotationsOn([day, other], "2026-10-08")).toEqual([day]);
  });

  it("answers an empty day with no annotations", () => {
    expect(annotationsOn([day, other], "2026-10-07")).toEqual([]);
  });
});

describe("annotationsInScope", () => {
  const global = annotation({ id: "ann-1", market: null });
  const german = annotation({ id: "ann-2", market: "de" });
  const american = annotation({ id: "ann-3", market: "us" });

  it("keeps every annotation when no market is selected", () => {
    expect(annotationsInScope([global, german], undefined)).toEqual([
      global,
      german,
    ]);
  });

  it("keeps global annotations and the ones of the selected market", () => {
    expect(annotationsInScope([global, german, american], "de")).toEqual([
      global,
      german,
    ]);
  });
});

describe("annotationsInMarkets", () => {
  const global = annotation({ id: "ann-1", market: null });
  const german = annotation({ id: "ann-2", market: "de" });
  const american = annotation({ id: "ann-3", market: "us" });

  it("keeps every annotation when the chart plots no market", () => {
    expect(annotationsInMarkets([global, german], [])).toEqual([
      global,
      german,
    ]);
  });

  it("keeps global annotations and the ones of the plotted markets", () => {
    expect(annotationsInMarkets([global, german, american], ["us"])).toEqual([
      global,
      american,
    ]);
  });

  it("keeps the annotations of every market the chart plots", () => {
    expect(
      annotationsInMarkets([global, german, american], ["us", "de"]),
    ).toEqual([global, german, american]);
  });
});

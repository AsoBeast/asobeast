import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import enFormat from "../../../messages/en/format.json";
import zhFormat from "../../../messages/zh-CN/format.json";
import type { Locale } from "@/lib/locale";
import { GRADES, type Grade } from "@/lib/grade";
import { GradedNumber } from "./graded";

const messages = { en: enFormat, "zh-CN": zhFormat };

function gradedMarkup(grade: Grade | null, locale: Locale = "en") {
  return renderToString(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ format: messages[locale] }}
    >
      <GradedNumber value="42" grade={grade} label="Difficulty" />
    </NextIntlClientProvider>,
  );
}

function markerClasses(grade: Grade | null): string | null {
  const html = gradedMarkup(grade);
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

  it("names the grade in Chinese", () => {
    expect(gradedMarkup("strong", "zh-CN")).toContain("Difficulty 42, 强");
  });
});

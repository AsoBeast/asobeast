import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScreenshotItem } from "@asobeast/shared";
import type { FontMeasure } from "@/lib/store-preview/canvas-measure";
import type { PreviewListing } from "@/lib/store-preview/preview-listing";
import { STORE_TEXT_LAYOUTS } from "@/lib/store-preview/store-layouts";
import { CutNotes } from "./CutNotes";
import { CutText } from "./CutText";
import { StorePreview } from "./StorePreview";

const shot = (position: number): ScreenshotItem => ({
  position,
  url: `https://is1-ssl.mzstatic.com/shot-${position}.png`,
  caption: null,
  status: "read",
});

const appStoreListing: PreviewListing = {
  store: "APP_STORE",
  name: "Focus Timer",
  iconUrl: "https://is1-ssl.mzstatic.com/icon.png",
  title: "Focus Timer",
  subtitle: "Pomodoro and deep work",
  shortDescription: null,
  promotionalText: null,
  description: "Plan your day in focused blocks.",
  developer: "Calm Labs",
  rating: { average: 4.6, count: 12840 },
  screenshots: [1, 2, 3].map(shot),
};

const playListing: PreviewListing = {
  ...appStoreListing,
  store: "GOOGLE_PLAY",
  subtitle: null,
  shortDescription: "Stay on task",
};

const markupOf = (listing: PreviewListing) =>
  renderToStaticMarkup(<StorePreview listing={listing} source="live" />);

const count = (markup: string, pattern: RegExp) =>
  markup.match(pattern)?.length ?? 0;

describe("StorePreview", () => {
  it("draws the search result with icon, title, subtitle, rating and three screenshots", () => {
    const markup = markupOf(appStoreListing);
    expect(markup).toContain("Focus Timer");
    expect(markup).toContain("Pomodoro and deep work");
    expect(markup).toContain("★★★★★");
    expect(markup).toContain("4.6");
    expect(markup).toContain("12.8K");
    expect(markup).toContain(">Get<");
    expect(count(markup, /alt="Screenshot \d"/g)).toBe(3);
    expect(markup).toContain("The newest captured listing");
  });

  it("draws the Play search card with title, developer and rating and no subtitle", () => {
    const markup = markupOf(playListing);
    expect(markup).toContain("Focus Timer");
    expect(markup).toContain("Calm Labs");
    expect(markup).toContain("4.6");
    expect(markup).not.toContain("Pomodoro and deep work");
    expect(markup).not.toContain(">Get<");
  });

  it("draws no screenshot row for a listing without screenshots", () => {
    const markup = markupOf({ ...appStoreListing, screenshots: [] });
    expect(markup).toContain("No screenshots captured yet");
    expect(markup).not.toContain("store-preview-screenshots");
  });

  it("draws No ratings yet without a rating", () => {
    expect(markupOf({ ...appStoreListing, rating: null })).toContain(
      "No ratings yet",
    );
  });

  it("describes the frame once", () => {
    const markup = markupOf(appStoreListing);
    expect(count(markup, /role="img"/g)).toBe(1);
    expect(markup).toContain(
      'aria-label="App Store search result: Focus Timer"',
    );
  });

  it("draws store text in the direction of its own script", () => {
    const markup = markupOf({ ...appStoreListing, title: "مؤقت التركيز" });
    expect(markup).toMatch(/<span dir="auto"[^>]*>مؤقت التركيز<\/span>/);
  });

  it("says when it shows the draft", () => {
    expect(
      renderToStaticMarkup(
        <StorePreview listing={appStoreListing} source="draft" />,
      ),
    ).toContain("Your draft");
  });
});

const eightPerCharacter: FontMeasure = () => (text) =>
  Array.from(text).length * 8;

describe("CutText", () => {
  const layout = STORE_TEXT_LAYOUTS.APP_STORE.product.title;

  it("draws each fitted line in its own element and ends a cut with an ellipsis", () => {
    const markup = renderToStaticMarkup(
      <CutText
        text="GeoGuess Map Explorer: World Quiz and Travel Trivia"
        layout={layout}
        device="small"
        measure={eightPerCharacter}
      />,
    );
    expect(markup).toContain('data-cut="true"');
    expect(markup).toContain(
      '<span class="block overflow-hidden whitespace-pre">GeoGuess Map Explorer:</span>',
    );
    expect(markup).toMatch(
      /<span class="block[^"]*">World Quiz and[^<]*…<\/span>/,
    );
  });

  it("clamps the whole text with CSS until the measure is ready", () => {
    const markup = renderToStaticMarkup(
      <CutText
        text="GeoGuess Map Explorer"
        layout={layout}
        device="small"
        measure={null}
      />,
    );
    expect(markup).toContain("-webkit-line-clamp:2");
    expect(markup).not.toContain("data-cut");
  });
});

describe("CutNotes", () => {
  it("writes each sentence with its words isolated and marks the estimate", () => {
    const markup = renderToStaticMarkup(
      <CutNotes
        cuts={[
          {
            field: "title",
            lead: "Cut after “",
            words: "GeoGuess Map",
            rest: "” on smaller iPhones. Words after the cut still count for search.",
          },
        ]}
      />,
    );
    expect(markup).toContain(
      "<p><span>Cut after “</span><bdi>GeoGuess Map</bdi><span>” on smaller iPhones. Words after the cut still count for search.</span></p>",
    );
    expect(markup).toContain("<span>Estimate</span>");
    expect(markup).toContain('aria-label="About the estimate"');
  });

  it("draws nothing without a cut", () => {
    expect(renderToStaticMarkup(<CutNotes cuts={[]} />)).toBe("");
  });
});

import type {
  KeywordInspection,
  KeywordInspectionSummary,
} from "@asobeast/shared";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalogs } from "@/i18n/messages";
import enKeywordInspector from "../../../messages/en/keywordInspector.json";
import { InspectionNotes } from "./InspectionExtras";

const inspection: KeywordInspection = {
  id: "inspection-1",
  keywordId: "keyword-1",
  keyword: "habit tracker",
  store: "APP_STORE",
  country: "us",
  status: "DONE",
  requestedAt: "2026-11-24T10:00:00.000Z",
  startedAt: "2026-11-24T10:00:01.000Z",
  completedAt: "2026-11-24T10:00:05.000Z",
  volume: 65,
  difficulty100: 18,
  opportunity: 70,
  resultCount: 10,
  provenance: null,
  suggestReach: "hit",
  signals: {
    suggestReach: "hit",
    suggestPrefixLength: 5,
    suggestPosition: 1,
    serpRelevance: 0.9,
    medianRatingCount: 45_000,
    flags: [],
    officialPopularity: 41,
    officialPopularityState: "floor",
    officialPopularityFloor: 41,
    officialPopularityWeek: "2026-10-18",
    estimatedTraffic: 5.4,
  },
  competition: null,
  results: [],
  suggestions: [],
  previous: {
    inspectionId: "inspection-0",
    completedAt: "2026-11-23T10:00:05.000Z",
    volume: 61,
    difficulty100: 22,
    resultCount: 10,
    entered: [{ storeAppId: "store-2", title: "Beta App" }],
    left: [{ storeAppId: "store-1", title: "Alpha App" }],
  },
  failure: null,
};

const elsewhere: KeywordInspectionSummary = {
  id: "inspection-gb",
  keywordId: "keyword-1",
  keyword: "habit tracker",
  store: "APP_STORE",
  country: "gb",
  status: "DONE",
  requestedAt: "2026-11-24T10:00:00.000Z",
  startedAt: "2026-11-24T10:00:01.000Z",
  completedAt: "2026-11-24T10:00:05.000Z",
  volume: 65,
  difficulty100: 18,
  opportunity: 70,
  resultCount: 10,
};

function notesMessages(overrides: Record<string, unknown>) {
  return {
    ...catalogs.en,
    keywordInspector: {
      ...enKeywordInspector,
      inspector: {
        ...enKeywordInspector.inspector,
        notes: { ...enKeywordInspector.inspector.notes, ...overrides },
      },
    },
  } as Parameters<typeof NextIntlClientProvider>[0]["messages"];
}

function renderNotes(
  value: KeywordInspection,
  items: readonly KeywordInspectionSummary[],
  overrides: Record<string, unknown> = {},
): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={notesMessages(overrides)}
    >
      <InspectionNotes
        inspection={value}
        elsewhere={items}
        onSelect={() => undefined}
      />
    </NextIntlClientProvider>,
  );
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, "");
}

describe("inspection movement messages", () => {
  it("lets a reordered catalog place left, date and entered clauses in any order", () => {
    const markup = renderNotes(inspection, [], {
      delta:
        "<left>{leftTitles}</left> LEFT | {date} | <entered>{enteredTitles}</entered> ENTERED",
    });

    expect(text(markup)).toContain(
      "Alpha App LEFT | Nov 23, 2026, 10:00 AM UTC | Beta App ENTERED",
    );
  });

  it.each([
    { name: "both", entered: true, left: true },
    { name: "entered only", entered: true, left: false },
    { name: "left only", entered: false, left: true },
    { name: "neither", entered: false, left: false },
  ])("omits absent $name clauses", ({ entered, left }) => {
    const value: KeywordInspection = {
      ...inspection,
      volume: null,
      difficulty100: null,
      previous: {
        ...inspection.previous!,
        entered: entered ? inspection.previous!.entered : [],
        left: left ? inspection.previous!.left : [],
      },
    };
    const output = text(renderNotes(value, []));

    expect(output.includes("Beta App entered the top 10")).toBe(entered);
    expect(output.includes("Alpha App left the top 10")).toBe(left);
    expect(output).toContain("Since Nov 23, 2026, 10:00 AM UTC");
  });

  it("lets a reordered score-change message control label, value and tone order", () => {
    const output = text(
      renderNotes(inspection, [], { change: "{tone}:{change}:{label}" }),
    );

    expect(output).toContain("better:+4:Popularity");
    expect(output).toContain("better:−4:Difficulty");
  });
});

describe("inspection elsewhere messages", () => {
  it("lets a reordered catalog place elsewhere links before autocomplete", () => {
    const output = text(
      renderNotes(
        { ...inspection, volume: null, difficulty100: null, previous: null },
        [elsewhere],
        {
          search:
            "<elsewhereText>{items}</elsewhereText> || <autocompleteText>{autocomplete}</autocompleteText>",
          elsewhere: "ELSEWHERE:<links>{items}</links>",
        },
      ),
    );

    expect(output).toContain(
      "ELSEWHERE:App Store · GB || Autocomplete suggests it in position 1 after 5 typed characters",
    );
  });

  it("omits absent autocomplete and elsewhere clauses", () => {
    const elsewhereOnly = text(
      renderNotes(
        {
          ...inspection,
          volume: null,
          difficulty100: null,
          previous: null,
          signals: null,
        },
        [elsewhere],
      ),
    );
    const autocompleteOnly = text(
      renderNotes(
        { ...inspection, volume: null, difficulty100: null, previous: null },
        [],
      ),
    );

    expect(elsewhereOnly).toContain("Also inspected in App Store · GB");
    expect(elsewhereOnly).not.toContain("Autocomplete");
    expect(autocompleteOnly).toContain(
      "Autocomplete suggests it in position 1 after 5 typed characters",
    );
    expect(autocompleteOnly).not.toContain("Also inspected in");
  });
});

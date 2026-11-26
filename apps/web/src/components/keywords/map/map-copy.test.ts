import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import enKeywordInspector from "../../../../messages/en/keywordInspector.json";
import { translationContext } from "@/test/translation-context";
import { dotName, type MapPoint } from "./map-points";

const point = (overrides: Partial<MapPoint>): MapPoint => ({
  keywordId: "kw-1",
  text: "focus timer",
  country: "us",
  popularity: 62,
  difficulty: 18,
  zone: "quickWins",
  opportunity: 82,
  position: 3,
  depth: 200,
  positionLabel: "3",
  ranked: true,
  floor: false,
  active: true,
  ...overrides,
});

const reorderedDotTranslator = createTranslator({
  locale: "en",
  namespace: "keywordInspector",
  messages: {
    keywordInspector: {
      ...enKeywordInspector,
      map: {
        ...enKeywordInspector.map,
        dot: {
          ...enKeywordInspector.map.dot,
          name: "{zone}|{paused, select, none {} other {PAUSED}}|{opportunity, select, none {} other {OP={opportunity}}}|{floor, select, none {} other {FLOOR}}|{rankState, select, unchecked {UNCHECKED} notFound {MISSING={depth, number}} ranked {RANK={rank}} other {UNKNOWN}}|D={difficulty}|P={popularity}|K={keyword}",
        },
      },
    },
  } as Parameters<typeof createTranslator>[0]["messages"],
});

describe("dotName", () => {
  it("names a ranked dot in words", () => {
    expect(dotName(point({}), false)).toBe(
      "focus timer, position 3, popularity 62, difficulty 18, opportunity 82, Quick wins",
    );
  });

  it("names an unranked dot by the depth of its row", () => {
    expect(
      dotName(
        point({
          text: "study timer",
          position: null,
          depth: 100,
          positionLabel: ">100",
          ranked: false,
        }),
        false,
      ),
    ).toBe(
      "study timer, not in the top 100, popularity 62, difficulty 18, opportunity 82, Quick wins",
    );
  });

  it("names a never checked dot", () => {
    expect(
      dotName(
        point({
          position: null,
          depth: null,
          positionLabel: null,
          ranked: false,
        }),
        false,
      ),
    ).toContain(", not checked yet, ");
  });

  it("names a floor answer, a pause and a missing opportunity", () => {
    const name = dotName(
      point({ popularity: 41, floor: true, active: false, opportunity: null }),
      false,
    );

    expect(name).toContain("popularity 41, floor answer");
    expect(name).not.toContain("opportunity");
    expect(name.endsWith(", paused")).toBe(true);
  });

  it("adds the market when the page has several", () => {
    expect(dotName(point({}), true).startsWith("focus timer (US), ")).toBe(
      true,
    );
  });

  it("localizes the spoken dot name without translating the keyword", () => {
    const zh = translationContext("zh-CN", "keywordInspector").translator;
    expect(dotName(point({}), false, zh)).toBe(
      "focus timer，排名第 3 位，热度 62，难度 18，机会 82，快速取胜",
    );
    expect(
      dotName(
        point({
          position: null,
          depth: null,
          positionLabel: null,
          ranked: false,
        }),
        false,
        zh,
      ),
    ).toContain("，尚未检查，");
  });

  it("uses the complete ICU message and every optional clause", () => {
    expect(
      dotName(
        point({ floor: true, active: false }),
        false,
        reorderedDotTranslator,
      ),
    ).toBe("Quick wins|PAUSED|OP=82|FLOOR|RANK=3|D=18|P=62|K=focus timer");
    expect(
      dotName(
        point({
          position: null,
          depth: null,
          positionLabel: null,
          ranked: false,
          opportunity: null,
        }),
        false,
        reorderedDotTranslator,
      ),
    ).toBe("Quick wins||||UNCHECKED|D=18|P=62|K=focus timer");
    expect(
      dotName(
        point({
          position: null,
          depth: 100,
          positionLabel: ">100",
          ranked: false,
          floor: true,
        }),
        false,
        reorderedDotTranslator,
      ),
    ).toBe("Quick wins||OP=82|FLOOR|MISSING=100|D=18|P=62|K=focus timer");
  });
});

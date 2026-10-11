import { describe, expect, it } from "vitest";
import type { CompetitorKeywordIdea } from "@asobeast/shared";
import { groupIdeasBySeed, ideaSignal, ideaUsers } from "./keyword-idea-groups";

const idea = (
  over: Partial<CompetitorKeywordIdea> = {},
): CompetitorKeywordIdea => ({
  text: "travel map tracker",
  popularity: null,
  suggestRank: 1,
  seed: "travel map",
  usedBy: [],
  ...over,
});

describe("groupIdeasBySeed", () => {
  it("groups ideas under their seed in the order the seeds were asked", () => {
    const groups = groupIdeasBySeed(
      ["travel planner", "travel map"],
      [
        idea(),
        idea({ text: "ai travel planner", seed: "travel planner" }),
        idea({ text: "travel map free" }),
      ],
    );

    expect(groups.map((group) => group.seed)).toEqual([
      "travel planner",
      "travel map",
    ]);
    expect(groups[1].ideas.map((entry) => entry.text)).toEqual([
      "travel map tracker",
      "travel map free",
    ]);
  });

  it("leaves out a seed that returned nothing", () => {
    expect(groupIdeasBySeed(["bucket list", "travel map"], [idea()])).toEqual([
      { seed: "travel map", ideas: [idea()] },
    ]);
  });
});

describe("ideaSignal", () => {
  it("names the position in the suggestions", () => {
    expect(ideaSignal(idea({ suggestRank: 3 }))).toBe(
      "#3 in search suggestions",
    );
  });

  it("leads with the Apple popularity when there is one", () => {
    expect(ideaSignal(idea({ popularity: 55 }))).toBe(
      "Apple popularity 55 · #1 in search suggestions",
    );
  });
});

describe("ideaUsers", () => {
  it("names the competitors whose listing covers the idea", () => {
    expect(
      ideaUsers(
        idea({
          usedBy: [
            { appId: "a", name: "Been" },
            { appId: "b", name: null },
          ],
        }),
        "Competitor",
      ),
    ).toBe("Covered by Been, Competitor");
  });

  it("says nothing when no competitor covers it", () => {
    expect(ideaUsers(idea(), "Competitor")).toBeNull();
  });
});

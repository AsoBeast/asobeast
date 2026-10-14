import type { AppSetupState } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  applySetupPatch,
  beginSetup,
  completeSetup,
  dismissSetup,
  reviewCountries,
  selectMarket,
  skipStep,
  type SetupTransition,
} from "./setup-transitions";

const NOW = new Date("2026-10-14T10:00:00.000Z");

const setup = (overrides: Partial<AppSetupState> = {}): AppSetupState => ({
  appId: "app-1",
  status: "in_progress",
  skipped: [],
  countriesReviewed: false,
  selectedMarkets: ["us"],
  completedAt: null,
  updatedAt: "2026-10-14T09:00:00.000Z",
  ...overrides,
});

const run = (state: AppSetupState, ...transitions: SetupTransition[]) =>
  transitions.reduce((current, transition) => {
    const patch = transition(current);
    return patch ? applySetupPatch(current, patch, NOW) : current;
  }, state);

describe("beginSetup", () => {
  it("starts and restarts with the home market only", () => {
    expect(beginSetup("US")(setup({ status: "dismissed" }))).toEqual({
      status: "in_progress",
      skipped: [],
      countriesReviewed: false,
      selectedMarkets: ["us"],
    });
  });

  it("ignores a home market that is no country code", () => {
    expect(beginSetup("usa")(setup({ status: "not_started" }))).toBeNull();
  });
});

describe("selectMarket", () => {
  it("normalizes, deduplicates and sorts markets", () => {
    const state = run(
      setup(),
      selectMarket("PL", true),
      selectMarket("pl", true),
      selectMarket("invalid", true),
    );

    expect(state.selectedMarkets).toEqual(["pl", "us"]);
  });

  it("never removes the last market", () => {
    const state = run(
      setup(),
      selectMarket("pl", true),
      selectMarket("pl", false),
      selectMarket("us", false),
    );

    expect(state.selectedMarkets).toEqual(["us"]);
  });

  it("sends the whole market list and marks countries reviewed", () => {
    expect(selectMarket("de", true)(setup())).toEqual({
      selectedMarkets: ["de", "us"],
      countriesReviewed: true,
    });
  });

  it("sends nothing when a choice changes nothing", () => {
    expect(selectMarket("us", true)(setup())).toBeNull();
    expect(selectMarket("us", false)(setup())).toBeNull();
  });
});

describe("skipStep", () => {
  it("adds and removes a step once, in step order", () => {
    const state = run(
      setup(),
      skipStep("countries", true),
      skipStep("competitors", true),
      skipStep("competitors", true),
    );

    expect(state.skipped).toEqual(["competitors", "countries"]);
    expect(skipStep("countries", false)(state)).toEqual({
      skipped: ["competitors"],
    });
  });
});

describe("reviewCountries", () => {
  it("marks countries reviewed once", () => {
    expect(reviewCountries()(setup())).toEqual({ countriesReviewed: true });
    expect(reviewCountries()(setup({ countriesReviewed: true }))).toBeNull();
  });
});

describe("terminal transitions", () => {
  it("completes and dismisses a setup in progress", () => {
    expect(completeSetup()(setup())).toEqual({ status: "completed" });
    expect(dismissSetup()(setup())).toEqual({ status: "dismissed" });
  });

  it("freezes a setup that is not in progress", () => {
    const completed = setup({ status: "completed" });
    const dismissed = setup({ status: "dismissed" });

    expect(dismissSetup()(completed)).toBeNull();
    expect(completeSetup()(dismissed)).toBeNull();
    expect(selectMarket("pl", true)(dismissed)).toBeNull();
    expect(skipStep("keywords", true)(completed)).toBeNull();
    expect(reviewCountries()(setup({ status: "not_started" }))).toBeNull();
  });
});

describe("applySetupPatch", () => {
  it("stamps the update time and keeps every field it is not given", () => {
    expect(applySetupPatch(setup(), { skipped: ["keywords"] }, NOW)).toEqual(
      setup({ skipped: ["keywords"], updatedAt: NOW.toISOString() }),
    );
  });

  it("stamps completedAt once on completion and clears it otherwise", () => {
    const completed = applySetupPatch(setup(), { status: "completed" }, NOW);

    expect(completed.completedAt).toBe(NOW.toISOString());
    expect(
      applySetupPatch(
        completed,
        { status: "completed" },
        new Date("2026-10-15T00:00:00.000Z"),
      ).completedAt,
    ).toBe(NOW.toISOString());
    expect(
      applySetupPatch(completed, { status: "in_progress" }, NOW).completedAt,
    ).toBeNull();
  });
});

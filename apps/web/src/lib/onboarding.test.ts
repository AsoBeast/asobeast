import { describe, expect, it } from "vitest";
import {
  beginOnboarding,
  canCompleteOnboarding,
  completeOnboarding,
  dismissOnboarding,
  navigateToOnboarding,
  NOT_STARTED_ONBOARDING,
  ONBOARDING_VERSION,
  parseOnboardingState,
  readOnboardingState,
  restartOnboarding,
  setMarketSelected,
  setOnboardingAcknowledgement,
  writeOnboardingState,
  type OnboardingState,
} from "./onboarding";

const acknowledged = (state: OnboardingState): OnboardingState =>
  (
    [
      "noCompetitors",
      "keywordsConfirmed",
      "capacityReviewed",
      "alertsSkipped",
    ] as const
  ).reduce(
    (current, key) => setOnboardingAcknowledgement(current, key, true),
    state,
  );

const unavailableStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
};

describe("parseOnboardingState", () => {
  it.each([
    ["missing", null],
    ["unparsable", "not json"],
    ["a newer version", '{"version":2}'],
    ["an unknown status", '{"version":1,"status":"paused","appId":"app-1"}'],
    [
      "a lifecycle without an app",
      '{"version":1,"status":"in_progress","appId":null,"selectedMarkets":["us"]}',
    ],
    [
      "an unnormalized market",
      '{"version":1,"status":"in_progress","appId":"app-1","selectedMarkets":["US"],"acknowledgements":{"noCompetitors":false,"keywordsConfirmed":false,"capacityReviewed":false,"alertsSkipped":false}}',
    ],
  ])("resets %s record", (_case, stored) => {
    expect(parseOnboardingState(stored)).toEqual(NOT_STARTED_ONBOARDING);
  });

  it("round-trips a valid record", () => {
    const state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");

    expect(parseOnboardingState(JSON.stringify(state))).toEqual(state);
    expect(state.version).toBe(ONBOARDING_VERSION);
  });
});

describe("transitions", () => {
  it("starts only from a not-started record", () => {
    const started = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "US");

    expect(started.status).toBe("in_progress");
    expect(started.selectedMarkets).toEqual(["us"]);
    expect(beginOnboarding(started, "app-2", "gb")).toBe(started);
    expect(restartOnboarding("app-2", "gb").appId).toBe("app-2");
  });

  it("ignores an invalid app id or market when starting", () => {
    expect(beginOnboarding(NOT_STARTED_ONBOARDING, "", "us").status).toBe(
      "not_started",
    );
    expect(beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "usa").status).toBe(
      "not_started",
    );
  });

  it("normalizes, deduplicates and sorts markets", () => {
    let state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "US");
    state = setMarketSelected(state, "PL", true);
    state = setMarketSelected(state, "pl", true);
    state = setMarketSelected(state, "invalid", true);

    expect(state.selectedMarkets).toEqual(["pl", "us"]);
  });

  it("never removes the last market", () => {
    let state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");
    state = setMarketSelected(state, "pl", true);
    state = setMarketSelected(state, "pl", false);
    state = setMarketSelected(state, "us", false);

    expect(state.selectedMarkets).toEqual(["us"]);
  });

  it("completes only when every decision is made", () => {
    const state = acknowledged(
      beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us"),
    );

    expect(canCompleteOnboarding(state, 0, 0)).toBe(true);
    expect(completeOnboarding(state, 0, 0).status).toBe("completed");
    expect(
      canCompleteOnboarding(
        setOnboardingAcknowledgement(state, "capacityReviewed", false),
        0,
        0,
      ),
    ).toBe(false);
  });

  it("accepts live counts in place of acknowledgements", () => {
    let state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");
    state = setOnboardingAcknowledgement(state, "keywordsConfirmed", true);
    state = setOnboardingAcknowledgement(state, "capacityReviewed", true);

    expect(canCompleteOnboarding(state, 2, 1)).toBe(true);
    expect(canCompleteOnboarding(state, 0, 1)).toBe(false);
  });

  it("dismisses and freezes terminal records", () => {
    const state = acknowledged(
      beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us"),
    );
    const dismissed = dismissOnboarding(state);
    const completed = completeOnboarding(state, 0, 0);

    expect(dismissed.status).toBe("dismissed");
    expect(dismissOnboarding(completed)).toBe(completed);
    expect(setMarketSelected(dismissed, "pl", true)).toBe(dismissed);
    expect(
      setOnboardingAcknowledgement(completed, "alertsSkipped", false),
    ).toBe(completed);
  });
});

describe("guarded adapters", () => {
  it("falls back when storage throws", () => {
    expect(readOnboardingState(unavailableStorage)).toEqual(
      NOT_STARTED_ONBOARDING,
    );
    expect(
      writeOnboardingState(NOT_STARTED_ONBOARDING, unavailableStorage),
    ).toBe(false);
  });

  it("reports a failed navigation instead of throwing", () => {
    expect(
      navigateToOnboarding("app-1", () => {
        throw new Error("blocked");
      }),
    ).toBe(false);
    expect(navigateToOnboarding("app-1", () => undefined)).toBe(true);
  });
});

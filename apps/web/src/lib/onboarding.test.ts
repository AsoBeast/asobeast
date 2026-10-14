import { describe, expect, it } from "vitest";
import {
  beginOnboarding,
  canCompleteOnboarding,
  claimBrowserOnboarding,
  completeOnboarding,
  dismissOnboarding,
  navigateToOnboarding,
  NOT_STARTED_ONBOARDING,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  onboardingStorageKey,
  parseOnboardingState,
  readOnboardingState,
  restartOnboarding,
  setMarketSelected,
  setOnboardingAcknowledgement,
  setupSteps,
  stepLabel,
  reviewedStepsSentence,
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

const readyExceptCapacity = (): OnboardingState =>
  setOnboardingAcknowledgement(
    beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us"),
    "keywordsConfirmed",
    true,
  );

const unavailableStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const dismissedSetup = (): OnboardingState =>
  dismissOnboarding(beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us"));

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

    expect(canCompleteOnboarding(state, 0, 0, setupSteps(true))).toBe(true);
    expect(completeOnboarding(state, 0, 0, setupSteps(true)).status).toBe(
      "completed",
    );
    expect(
      canCompleteOnboarding(
        setOnboardingAcknowledgement(state, "capacityReviewed", false),
        0,
        0,
        setupSteps(true),
      ),
    ).toBe(false);
  });

  it("accepts live counts in place of acknowledgements", () => {
    let state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");
    state = setOnboardingAcknowledgement(state, "keywordsConfirmed", true);
    state = setOnboardingAcknowledgement(state, "capacityReviewed", true);

    expect(canCompleteOnboarding(state, 2, 1, setupSteps(true))).toBe(true);
    expect(canCompleteOnboarding(state, 0, 1, setupSteps(true))).toBe(false);
  });

  it("dismisses and freezes terminal records", () => {
    const state = acknowledged(
      beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us"),
    );
    const dismissed = dismissOnboarding(state);
    const completed = completeOnboarding(state, 0, 0, setupSteps(true));

    expect(dismissed.status).toBe("dismissed");
    expect(dismissOnboarding(completed)).toBe(completed);
    expect(setMarketSelected(dismissed, "pl", true)).toBe(dismissed);
    expect(
      setOnboardingAcknowledgement(completed, "alertsSkipped", false),
    ).toBe(completed);
  });
});

describe("setupSteps", () => {
  it("includes capacity for the platform operator", () => {
    expect(setupSteps(true)).toEqual([
      "markets",
      "competitors",
      "keywords",
      "capacity",
      "alerts",
    ]);
  });

  it("leaves capacity out for everyone else", () => {
    expect(setupSteps(false)).toEqual([
      "markets",
      "competitors",
      "keywords",
      "alerts",
    ]);
  });

  it("completes without a capacity review when capacity is not a step", () => {
    const state = readyExceptCapacity();
    expect(canCompleteOnboarding(state, 1, 1, setupSteps(false))).toBe(true);
    expect(canCompleteOnboarding(state, 1, 1, setupSteps(true))).toBe(false);
    expect(completeOnboarding(state, 1, 1, setupSteps(false)).status).toBe(
      "completed",
    );
  });
});

describe("stepLabel", () => {
  it("numbers a step within the steps shown", () => {
    expect(stepLabel("alerts", setupSteps(false))).toBe("Step 4 of 4");
    expect(stepLabel("alerts", setupSteps(true))).toBe("Step 5 of 5");
    expect(stepLabel("capacity", setupSteps(true))).toBe("Step 4 of 5");
  });
});

describe("reviewedStepsSentence", () => {
  it("names every step shown", () => {
    expect(reviewedStepsSentence(setupSteps(true))).toBe(
      "Markets, competitors, keywords, capacity and alerts have been reviewed.",
    );
    expect(reviewedStepsSentence(setupSteps(false))).toBe(
      "Markets, competitors, keywords and alerts have been reviewed.",
    );
  });
});

describe("guarded adapters", () => {
  it("falls back when storage throws", () => {
    expect(readOnboardingState("u1", unavailableStorage)).toEqual(
      NOT_STARTED_ONBOARDING,
    );
    expect(
      writeOnboardingState("u1", NOT_STARTED_ONBOARDING, unavailableStorage),
    ).toBe(false);
  });

  it("keeps the progress of each account apart", () => {
    const storage = memoryStorage();
    const finished = dismissedSetup();

    expect(writeOnboardingState("u1", finished, storage)).toBe(true);

    expect(readOnboardingState("u1", storage)).toEqual(finished);
    expect(readOnboardingState("u2", storage)).toEqual(NOT_STARTED_ONBOARDING);
  });
});

describe("claimBrowserOnboarding", () => {
  it("hands browser wide progress to the first account that reads it", () => {
    const finished = JSON.stringify(dismissedSetup());
    const storage = memoryStorage({ [ONBOARDING_STORAGE_KEY]: finished });

    expect(claimBrowserOnboarding("u1", storage)).toBe(true);
    expect(claimBrowserOnboarding("u2", storage)).toBe(false);

    expect(storage.items.get(onboardingStorageKey("u1"))).toBe(finished);
    expect(storage.items.has(onboardingStorageKey("u2"))).toBe(false);
    expect(storage.items.has(ONBOARDING_STORAGE_KEY)).toBe(false);
  });

  it("never overwrites progress the account already keeps", () => {
    const own = JSON.stringify(NOT_STARTED_ONBOARDING);
    const storage = memoryStorage({
      [ONBOARDING_STORAGE_KEY]: JSON.stringify(dismissedSetup()),
      [onboardingStorageKey("u1")]: own,
    });

    expect(claimBrowserOnboarding("u1", storage)).toBe(true);

    expect(storage.items.get(onboardingStorageKey("u1"))).toBe(own);
    expect(storage.items.has(ONBOARDING_STORAGE_KEY)).toBe(false);
  });

  it("claims nothing when storage is unavailable", () => {
    expect(claimBrowserOnboarding("u1", unavailableStorage)).toBe(false);
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

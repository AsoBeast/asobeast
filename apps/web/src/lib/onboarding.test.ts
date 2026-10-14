import { describe, expect, it } from "vitest";
import {
  activeKeywordCount,
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
  SETUP_KEYWORD_TARGET,
  setCountriesReviewed,
  setMarketSelected,
  setStepSkipped,
  setupProgress,
  stepLabel,
  stepState,
  writeOnboardingState,
  type OnboardingState,
  type SetupCounts,
} from "./onboarding";

const counts = (
  competitors: number | null,
  keywords: number | null,
): SetupCounts => ({ competitors, keywords });

const started = (): OnboardingState =>
  beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");

const versionOne = (acknowledgements: Record<string, unknown>) =>
  JSON.stringify({
    version: 1,
    status: "in_progress",
    appId: "app-1",
    selectedMarkets: ["de", "us"],
    acknowledgements,
  });

const VERSION_ONE_ACKNOWLEDGEMENTS = {
  noCompetitors: true,
  keywordsConfirmed: true,
  capacityReviewed: true,
  alertsSkipped: true,
};

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
    ["a newer version", '{"version":3}'],
    ["an unknown status", '{"version":2,"status":"paused","appId":"app-1"}'],
    [
      "a lifecycle without an app",
      '{"version":2,"status":"in_progress","appId":null,"selectedMarkets":["us"],"skipped":[],"countriesReviewed":false}',
    ],
    [
      "an unnormalized market",
      '{"version":2,"status":"in_progress","appId":"app-1","selectedMarkets":["US"],"skipped":[],"countriesReviewed":false}',
    ],
    [
      "an unknown skipped step",
      '{"version":2,"status":"in_progress","appId":"app-1","selectedMarkets":["us"],"skipped":["alerts"],"countriesReviewed":false}',
    ],
    [
      "a repeated skipped step",
      '{"version":2,"status":"in_progress","appId":"app-1","selectedMarkets":["us"],"skipped":["keywords","keywords"],"countriesReviewed":false}',
    ],
    [
      "a missing review flag",
      '{"version":2,"status":"in_progress","appId":"app-1","selectedMarkets":["us"],"skipped":[]}',
    ],
    [
      "a version 1 record with a corrupt acknowledgement",
      versionOne({ ...VERSION_ONE_ACKNOWLEDGEMENTS, alertsSkipped: "yes" }),
    ],
  ])("resets %s record", (_case, stored) => {
    expect(parseOnboardingState(stored)).toEqual(NOT_STARTED_ONBOARDING);
  });

  it("round-trips a valid record", () => {
    const state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");

    expect(parseOnboardingState(JSON.stringify(state))).toEqual(state);
    expect(state.version).toBe(ONBOARDING_VERSION);
  });

  it("upgrades a version 1 record and keeps its status, app and markets", () => {
    expect(
      parseOnboardingState(versionOne(VERSION_ONE_ACKNOWLEDGEMENTS)),
    ).toEqual({
      version: ONBOARDING_VERSION,
      status: "in_progress",
      appId: "app-1",
      selectedMarkets: ["de", "us"],
      skipped: ["competitors"],
      countriesReviewed: false,
    });
  });

  it("upgrades a version 1 record without competitors acknowledged to no skipped step", () => {
    expect(
      parseOnboardingState(
        versionOne({ ...VERSION_ONE_ACKNOWLEDGEMENTS, noCompetitors: false }),
      ).skipped,
    ).toEqual([]);
  });

  it("reads skipped steps back in step order", () => {
    const stored = JSON.stringify({
      ...started(),
      skipped: ["countries", "competitors"],
    });

    expect(parseOnboardingState(stored).skipped).toEqual([
      "competitors",
      "countries",
    ]);
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

  it("marks countries reviewed once a market is chosen", () => {
    expect(started().countriesReviewed).toBe(false);
    expect(setMarketSelected(started(), "pl", true).countriesReviewed).toBe(
      true,
    );
    expect(setCountriesReviewed(started()).countriesReviewed).toBe(true);
  });

  it("leaves countries unreviewed when a choice changes nothing", () => {
    expect(setMarketSelected(started(), "us", true).countriesReviewed).toBe(
      false,
    );
    expect(setMarketSelected(started(), "us", false).countriesReviewed).toBe(
      false,
    );
  });

  it("counts only active keywords", () => {
    expect(
      activeKeywordCount([
        { active: true },
        { active: false },
        { active: true },
      ]),
    ).toBe(2);
  });

  it("dismisses and freezes terminal records", () => {
    const state = setCountriesReviewed(started());
    const dismissed = dismissOnboarding(state);
    const completed = completeOnboarding(state, counts(1, 10));

    expect(dismissed.status).toBe("dismissed");
    expect(completed.status).toBe("completed");
    expect(dismissOnboarding(completed)).toBe(completed);
    expect(setMarketSelected(dismissed, "pl", true)).toBe(dismissed);
    expect(setStepSkipped(completed, "keywords", true)).toBe(completed);
    expect(setCountriesReviewed(dismissed)).toBe(dismissed);
  });
});

describe("stepState", () => {
  it("waits for the count a step reads", () => {
    expect(stepState(started(), "competitors", counts(null, 4))).toBe(
      "loading",
    );
    expect(stepState(started(), "keywords", counts(1, null))).toBe("loading");
    expect(stepState(started(), "countries", counts(null, null))).toBe("open");
  });

  it("finishes the competitor step at one competitor", () => {
    expect(stepState(started(), "competitors", counts(0, 0))).toBe("open");
    expect(stepState(started(), "competitors", counts(1, 0))).toBe("done");
  });

  it("finishes the keyword step at the keyword target", () => {
    expect(
      stepState(started(), "keywords", counts(0, SETUP_KEYWORD_TARGET - 1)),
    ).toBe("open");
    expect(
      stepState(started(), "keywords", counts(0, SETUP_KEYWORD_TARGET)),
    ).toBe("done");
  });

  it("finishes the countries step on review", () => {
    expect(
      stepState(setCountriesReviewed(started()), "countries", counts(0, 0)),
    ).toBe("done");
  });

  it("reports a skipped step as skipped until its target is reached", () => {
    const state = setStepSkipped(started(), "competitors", true);

    expect(stepState(state, "competitors", counts(null, 0))).toBe("skipped");
    expect(stepState(state, "competitors", counts(0, 0))).toBe("skipped");
    expect(stepState(state, "competitors", counts(1, 0))).toBe("done");
    expect(
      stepState(
        setCountriesReviewed(setStepSkipped(started(), "countries", true)),
        "countries",
        counts(0, 0),
      ),
    ).toBe("done");
    expect(
      stepState(
        setStepSkipped(state, "competitors", false),
        "competitors",
        counts(0, 0),
      ),
    ).toBe("open");
  });
});

describe("setupProgress", () => {
  it("counts done and skipped steps and names the first open one", () => {
    expect(setupProgress(started(), counts(1, 4))).toEqual({
      done: 1,
      total: 3,
      next: "keywords",
    });
    expect(
      setupProgress(setStepSkipped(started(), "keywords", true), counts(1, 4)),
    ).toEqual({ done: 2, total: 3, next: "countries" });
  });

  it("names a loading step as next", () => {
    expect(setupProgress(started(), counts(null, null)).next).toBe(
      "competitors",
    );
  });

  it("names no next step once every step is settled", () => {
    expect(
      setupProgress(setCountriesReviewed(started()), counts(2, 12)),
    ).toEqual({ done: 3, total: 3, next: null });
  });
});

describe("canCompleteOnboarding", () => {
  const settled = (): OnboardingState =>
    setStepSkipped(
      setStepSkipped(setCountriesReviewed(started()), "competitors", true),
      "keywords",
      true,
    );

  it("completes once every step is done or skipped", () => {
    expect(canCompleteOnboarding(settled(), counts(0, 0))).toBe(true);
    expect(
      canCompleteOnboarding(setCountriesReviewed(started()), counts(1, 10)),
    ).toBe(true);
    expect(completeOnboarding(settled(), counts(0, 0)).status).toBe(
      "completed",
    );
  });

  it("blocks completion while a count is loading", () => {
    expect(
      canCompleteOnboarding(setCountriesReviewed(started()), counts(null, 10)),
    ).toBe(false);
  });

  it("blocks completion while a step is open", () => {
    const state = setCountriesReviewed(started());

    expect(canCompleteOnboarding(state, counts(1, 9))).toBe(false);
    expect(canCompleteOnboarding(started(), counts(1, 10))).toBe(false);
    expect(completeOnboarding(state, counts(1, 9))).toBe(state);
  });

  it("completes only a setup in progress", () => {
    expect(canCompleteOnboarding(NOT_STARTED_ONBOARDING, counts(1, 10))).toBe(
      false,
    );
  });
});

describe("setStepSkipped", () => {
  it("adds and removes a step once, in step order", () => {
    let state = setStepSkipped(started(), "countries", true);
    state = setStepSkipped(state, "competitors", true);
    state = setStepSkipped(state, "competitors", true);

    expect(state.skipped).toEqual(["competitors", "countries"]);
    expect(setStepSkipped(state, "countries", false).skipped).toEqual([
      "competitors",
    ]);
  });
});

describe("stepLabel", () => {
  it("numbers a step among three", () => {
    expect(stepLabel("competitors")).toBe("Step 1 of 3");
    expect(stepLabel("keywords")).toBe("Step 2 of 3");
    expect(stepLabel("countries")).toBe("Step 3 of 3");
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

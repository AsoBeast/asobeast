import { describe, expect, it } from "vitest";
import {
  SUPPORT_ACTIONS,
  SUPPORT_OUTCOMES,
  SUPPORT_REASON_MAX_LENGTH,
  type OnDemandRules,
  type PlanLimits,
} from "@asobeast/shared";
import {
  availableActions,
  dailyRunDone,
  focusAfter,
  limitRows,
  onDemandRows,
  queueLabel,
  supportActionLabel,
  supportActionRequest,
  supportOutcomeLabel,
  supportReasonReady,
  usageLine,
  usageRows,
} from "./admin-support";

const DAY = 86_400;
const HOUR = 3_600;

const LIMITS: PlanLimits = {
  apps: 3,
  keywordMarkets: 50,
  competitorsPerApp: 5,
  chartFollows: 4,
  apiRequestsPerMinute: 300,
  apiWritesPerMinute: 60,
  apiRequestsPerDay: 40_000,
  apiConcurrentRequests: 16,
  mcpRequestsPerMinute: 60,
  aiCallsPerMonth: 100,
  onDemand: null,
};

const RULES: OnDemandRules = {
  refresh: { limit: 50, windowSeconds: DAY },
  runDaily: { limit: 5, windowSeconds: DAY },
  score: { limit: 100, windowSeconds: DAY },
  suggestions: { limit: 60, windowSeconds: HOUR },
  spider: { limit: 12, windowSeconds: DAY },
  importApp: { limit: 10, windowSeconds: DAY },
  addCompetitor: { limit: 60, windowSeconds: DAY },
  storeLookup: { limit: 60, windowSeconds: HOUR },
  chartCapture: { limit: 30, windowSeconds: DAY },
};

describe("limitRows", () => {
  it("names every limit in a fixed order and writes unlimited for null", () => {
    expect(limitRows(LIMITS).map((row) => row.label)).toEqual([
      "Apps",
      "Keyword markets",
      "Competitors per app",
      "Followed charts",
      "AI calls per month",
      "API requests per minute",
      "API writes per minute",
      "API requests per day",
      "Concurrent API requests",
      "MCP requests per minute",
    ]);
    expect(limitRows({ ...LIMITS, apps: null })[0].value).toBe("Unlimited");
    expect(limitRows(LIMITS)[7].value).toBe("40,000");
  });
});

describe("usageLine", () => {
  it("says how much of a limit is used", () => {
    expect(usageLine(3, 10)).toBe("3 of 10");
    expect(usageLine(12, null)).toBe("12, no limit");
    expect(usageLine(1_200, 5_000)).toBe("1,200 of 5,000");
  });
});

describe("usageRows", () => {
  const usage = { members: 2, apps: 2, competitors: 3, keywordMarkets: 40 };

  it("puts what the workspace uses beside the limits that count it", () => {
    const rows = usageRows(LIMITS, usage);

    expect(rows.slice(0, 4)).toEqual([
      { label: "Members", value: "2" },
      { label: "Apps", value: "2 of 3" },
      { label: "Keyword markets", value: "40 of 50" },
      { label: "Competitors per app", value: "3 in all, up to 5 per app" },
    ]);
    expect(rows.slice(4)).toEqual(limitRows(LIMITS).slice(3));
  });

  it("says no limit where the plan sets none", () => {
    const rows = usageRows(
      { ...LIMITS, apps: null, competitorsPerApp: null },
      usage,
    );

    expect(rows[1].value).toBe("2, no limit");
    expect(rows[3].value).toBe("3 in all, no limit");
  });
});

describe("onDemandRows", () => {
  it("names each allowance and its window", () => {
    expect(
      onDemandRows({ ...RULES, refresh: { limit: 20, windowSeconds: DAY } })[0],
    ).toEqual({ label: "Refresh", value: "20 a day" });
    expect(onDemandRows(RULES).map((row) => row.label)).toEqual([
      "Refresh",
      "Daily runs",
      "Rescores",
      "Keyword suggestions",
      "Deep searches",
      "App imports",
      "Competitor adds",
      "Store lookups",
      "Chart captures",
    ]);
    expect(onDemandRows(RULES)[3].value).toBe("60 an hour");
  });

  it("writes a window the plans do not use yet in whole units", () => {
    const row = (windowSeconds: number) =>
      onDemandRows({ ...RULES, refresh: { limit: 1_000, windowSeconds } })[0]
        .value;

    expect(row(7 * DAY)).toBe("1,000 a week");
    expect(row(2 * HOUR)).toBe("1,000 every 2 hours");
    expect(row(15 * 60)).toBe("1,000 every 15 minutes");
    expect(row(90)).toBe("1,000 every 90 seconds");
  });

  it("is empty when the plan sets no on demand rules", () => {
    expect(onDemandRows(null)).toEqual([]);
  });
});

describe("support labels", () => {
  it("names every support action and outcome", () => {
    expect(SUPPORT_ACTIONS.map(supportActionLabel)).toEqual([
      "Listed workspaces",
      "Viewed",
      "Reconciled billing",
      "Suspended",
      "Restored",
      "Started a daily run",
      "Replayed a billing event",
    ]);
    expect(SUPPORT_OUTCOMES.map(supportOutcomeLabel)).toEqual([
      "In progress",
      "Succeeded",
      "Failed",
    ]);
  });
});

describe("queueLabel", () => {
  it("names the store of a queue and keeps an unknown name", () => {
    expect(queueLabel("appstore")).toBe("App Store");
    expect(queueLabel("gplay")).toBe("Google Play");
    expect(queueLabel("other")).toBe("other");
  });
});

describe("supportReasonReady", () => {
  it("is ready from eight characters, not counting spaces at the ends", () => {
    expect(supportReasonReady("")).toBe(false);
    expect(supportReasonReady("        ")).toBe(false);
    expect(supportReasonReady("  seven!!  ")).toBe(false);
    expect(supportReasonReady("  eight!!!  ")).toBe(true);
    expect(supportReasonReady("a".repeat(SUPPORT_REASON_MAX_LENGTH))).toBe(
      true,
    );
    expect(supportReasonReady("a".repeat(SUPPORT_REASON_MAX_LENGTH + 1))).toBe(
      false,
    );
  });
});

describe("supportActionRequest", () => {
  it("confirms and sends the reason without the spaces at its ends", () => {
    expect(supportActionRequest(`  ${"a".repeat(200)}  `)).toEqual({
      confirm: true,
      reason: "a".repeat(200),
    });
  });
});

describe("availableActions", () => {
  const ACTIVE = { operatorWorkspace: false, suspendedAt: null };
  const SUSPENDED = {
    operatorWorkspace: false,
    suspendedAt: "2026-11-17T08:05:00.000Z",
  };

  it("offers a daily run unless suspended, and reconcile only with billing", () => {
    expect(availableActions(ACTIVE, { billing: false })).toEqual([
      "run-daily",
      "suspend",
    ]);
    expect(availableActions(ACTIVE, { billing: true })).toEqual([
      "run-daily",
      "reconcile",
      "suspend",
    ]);
    expect(availableActions(SUSPENDED, { billing: true })).toEqual([
      "reconcile",
      "restore",
    ]);
    expect(availableActions(SUSPENDED, { billing: false })).toEqual([
      "restore",
    ]);
  });

  it("never offers to suspend the operator workspace", () => {
    expect(
      availableActions(
        { ...ACTIVE, operatorWorkspace: true },
        { billing: false },
      ),
    ).toEqual(["run-daily"]);
  });

  it("offers to restore an operator workspace an older release suspended", () => {
    expect(
      availableActions(
        { ...SUSPENDED, operatorWorkspace: true },
        { billing: false },
      ),
    ).toEqual(["restore"]);
  });
});

describe("focusAfter", () => {
  const ACTIVE = { operatorWorkspace: false, suspendedAt: null };
  const SUSPENDED = {
    operatorWorkspace: false,
    suspendedAt: "2026-11-17T08:05:00.000Z",
  };

  it("hands focus to the action that replaces the one taken", () => {
    expect(focusAfter("suspend", ACTIVE, { billing: true })).toBe("restore");
    expect(focusAfter("restore", SUSPENDED, { billing: true })).toBe("suspend");
  });

  it("hands focus to the first action left when the replacement is never offered", () => {
    expect(
      focusAfter(
        "restore",
        { ...SUSPENDED, operatorWorkspace: true },
        { billing: false },
      ),
    ).toBe("run-daily");
  });

  it("hands nothing on when the opener stays", () => {
    expect(focusAfter("run-daily", ACTIVE, { billing: true })).toBeNull();
    expect(focusAfter("reconcile", SUSPENDED, { billing: true })).toBeNull();
  });
});

describe("dailyRunDone", () => {
  it("says when nothing new was queued", () => {
    expect(
      dailyRunDone(
        "Ana Apps",
        "queued 0 apps, 0 keywords, 0 categories, 0 reviews",
      ),
    ).toBe("Nothing new to queue for Ana Apps today.");
  });

  it("says a run was queued when anything was", () => {
    expect(
      dailyRunDone(
        "Ana Apps",
        "queued 2 apps, 14 keywords, 1 categories, 2 reviews",
      ),
    ).toBe("Daily run queued for Ana Apps.");
    expect(
      dailyRunDone(
        "Ana Apps",
        "queued 0 apps, 0 keywords, 0 categories, 3 reviews",
      ),
    ).toBe("Daily run queued for Ana Apps.");
  });

  it("says a run was queued when the detail holds no count", () => {
    expect(dailyRunDone("Ana Apps", "queued")).toBe(
      "Daily run queued for Ana Apps.",
    );
  });
});

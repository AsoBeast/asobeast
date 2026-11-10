import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { FIRST_CHECK_POLL_LIMIT, FIRST_CHECK_POLL_MS } from "./keyword-checks";
import {
  inspectionListPollInterval,
  inspectionPollInterval,
  KEYWORD_INSPECTION_POLL_MS,
  KEYWORD_INSPECTION_POLL_WINDOW_MS,
} from "./keyword-inspection-polling";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");
const requestedAt = new Date(NOW - 1_000).toISOString();
const pending = { status: "PENDING" as const, requestedAt };
const done = { status: "DONE" as const, requestedAt };
const longPending = {
  status: "PENDING" as const,
  requestedAt: new Date(NOW - KEYWORD_INSPECTION_POLL_WINDOW_MS).toISOString(),
};
const notFound = new ApiError({
  statusCode: 404,
  error: "Not Found",
  message: "Keyword inspection x not found",
  path: "/keyword-inspections/x",
  timestamp: "2026-11-10T12:00:00.000Z",
});
const unreachable = new TypeError("Failed to fetch");

describe("inspection polling", () => {
  it("polls at the cadence and limit of the other first checks", () => {
    expect(KEYWORD_INSPECTION_POLL_MS).toBe(FIRST_CHECK_POLL_MS);
    expect(KEYWORD_INSPECTION_POLL_WINDOW_MS).toBe(
      FIRST_CHECK_POLL_MS * FIRST_CHECK_POLL_LIMIT,
    );
  });
});

describe("inspectionListPollInterval", () => {
  it("polls while any run is pending", () => {
    expect(
      inspectionListPollInterval(
        { data: { items: [done, pending] }, error: null, dataUpdateCount: 3 },
        NOW,
      ),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("stops once every run has finished", () => {
    expect(
      inspectionListPollInterval(
        { data: { items: [done] }, error: null, dataUpdateCount: 3 },
        NOW,
      ),
    ).toBe(false);
  });

  it("stops polling a run pending for longer than the poll limit covers", () => {
    expect(
      inspectionListPollInterval(
        { data: { items: [longPending] }, error: null, dataUpdateCount: 3 },
        NOW,
      ),
    ).toBe(false);
  });

  it("polls a new run however often the list was read before", () => {
    expect(
      inspectionListPollInterval(
        {
          data: { items: [pending] },
          error: null,
          dataUpdateCount: FIRST_CHECK_POLL_LIMIT * 3,
        },
        NOW,
      ),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("keeps polling through a failed request so a pending run recovers", () => {
    expect(
      inspectionListPollInterval(
        { data: { items: [pending] }, error: unreachable, dataUpdateCount: 3 },
        NOW,
      ),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("does not poll without data", () => {
    expect(
      inspectionListPollInterval(
        { data: undefined, error: null, dataUpdateCount: 0 },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("inspectionPollInterval", () => {
  it("polls a pending run and stops on a finished one", () => {
    expect(
      inspectionPollInterval({
        data: pending,
        error: null,
        dataUpdateCount: 1,
      }),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
    expect(
      inspectionPollInterval({ data: done, error: null, dataUpdateCount: 1 }),
    ).toBe(false);
  });

  it("stops after the poll limit", () => {
    expect(
      inspectionPollInterval({
        data: pending,
        error: null,
        dataUpdateCount: FIRST_CHECK_POLL_LIMIT - 1,
      }),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
    expect(
      inspectionPollInterval({
        data: pending,
        error: null,
        dataUpdateCount: FIRST_CHECK_POLL_LIMIT,
      }),
    ).toBe(false);
  });

  it("keeps polling a pending run through a failed request", () => {
    expect(
      inspectionPollInterval({
        data: pending,
        error: unreachable,
        dataUpdateCount: 1,
      }),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("stops once the run no longer exists", () => {
    expect(
      inspectionPollInterval({
        data: pending,
        error: notFound,
        dataUpdateCount: 1,
      }),
    ).toBe(false);
  });
});

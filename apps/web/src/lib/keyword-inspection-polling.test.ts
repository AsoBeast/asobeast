import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import {
  inspectionListPollInterval,
  inspectionPollInterval,
  KEYWORD_INSPECTION_POLL_MS,
} from "./keyword-inspection-polling";

const pending = { status: "PENDING" as const };
const done = { status: "DONE" as const };
const notFound = new ApiError({
  statusCode: 404,
  error: "Not Found",
  message: "Keyword inspection x not found",
  path: "/keyword-inspections/x",
  timestamp: "2026-11-10T12:00:00.000Z",
});
const unreachable = new TypeError("Failed to fetch");

describe("inspectionListPollInterval", () => {
  it("polls while any run is pending", () => {
    expect(
      inspectionListPollInterval({
        data: { items: [done, pending] },
        error: null,
      }),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("stops once every run has finished", () => {
    expect(
      inspectionListPollInterval({ data: { items: [done] }, error: null }),
    ).toBe(false);
  });

  it("keeps polling through a failed request so a pending run recovers", () => {
    expect(
      inspectionListPollInterval({
        data: { items: [pending] },
        error: unreachable,
      }),
    ).toBe(KEYWORD_INSPECTION_POLL_MS);
  });

  it("does not poll without data", () => {
    expect(inspectionListPollInterval({ data: undefined, error: null })).toBe(
      false,
    );
  });
});

describe("inspectionPollInterval", () => {
  it("polls a pending run and stops on a finished one", () => {
    expect(inspectionPollInterval({ data: pending, error: null })).toBe(
      KEYWORD_INSPECTION_POLL_MS,
    );
    expect(inspectionPollInterval({ data: done, error: null })).toBe(false);
  });

  it("keeps polling a pending run through a failed request", () => {
    expect(inspectionPollInterval({ data: pending, error: unreachable })).toBe(
      KEYWORD_INSPECTION_POLL_MS,
    );
  });

  it("stops once the run no longer exists", () => {
    expect(inspectionPollInterval({ data: pending, error: notFound })).toBe(
      false,
    );
  });
});

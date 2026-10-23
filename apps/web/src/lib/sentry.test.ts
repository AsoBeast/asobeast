import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  filterEvent,
  maskRoute,
  reportingDsn,
  reportingOptions,
  scrubEvent,
} from "./sentry";

const DSN = "https://publickey@errors.example.com/7";

function eventWith(overrides: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...overrides };
}

describe("reportingDsn", () => {
  it("hands out the dsn in production", () => {
    expect(reportingDsn(DSN, "production")).toBe(DSN);
  });

  it.each([
    ["nothing is configured", undefined, "production"],
    ["the value is blank", "   ", "production"],
    ["this is not production", DSN, "development"],
  ])("hands out nothing when %s", (_reason, dsn, nodeEnv) => {
    expect(reportingDsn(dsn, nodeEnv)).toBeNull();
  });
});

describe("maskRoute", () => {
  it("replaces identifiers and drops the query string", () => {
    expect(
      maskRoute("https://app.example.com/apps/clx8s9k2l0000abcdefghijkl?q=a"),
    ).toBe("https://app.example.com/apps/:id");
  });

  it("keeps a route with no identifier as it is", () => {
    expect(maskRoute("/settings")).toBe("/settings");
  });
});

describe("scrubEvent", () => {
  it("drops headers, cookies, body and query, and masks the route", () => {
    const event = eventWith({
      request: {
        method: "GET",
        url: "https://app.example.com/apps/clx8s9k2l0000abcdefghijkl",
        query_string: "term=habit+tracker",
        headers: { cookie: "asobeast_session=value" },
        cookies: { asobeast_session: "value" },
        data: { password: "hunter2" },
      },
      transaction: "/apps/clx8s9k2l0000abcdefghijkl",
    });

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request).toEqual({
      method: "GET",
      url: "https://app.example.com/apps/:id",
    });
    expect(scrubbed.transaction).toBe("/apps/:id");
  });

  it("masks the path onRequestError puts in the nextjs context", () => {
    const event = eventWith({
      contexts: {
        nextjs: {
          request_path: "/apps/clx8s9k2l0000abcdefghijkl/keywords?spider=habit",
          route_type: "render",
        },
      },
    });

    expect(scrubEvent(event).contexts?.nextjs).toEqual({
      request_path: "/apps/:id/keywords",
      route_type: "render",
    });
  });

  it("leaves a context that carries no path alone", () => {
    const contexts = { trace: { trace_id: "abc", span_id: "def" } };

    expect(scrubEvent(eventWith({ contexts })).contexts).toEqual(contexts);
  });

  it("leaves an event with no request alone", () => {
    expect(scrubEvent(eventWith({ message: "boom" }))).toEqual(
      eventWith({ message: "boom" }),
    );
  });
});

describe("reportingOptions", () => {
  it("collects nothing the scrubbing promise excludes", () => {
    expect(reportingOptions(DSN)).toEqual({
      dsn: DSN,
      environment: "production",
      maxBreadcrumbs: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { request: false, response: false },
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
      },
      beforeSend: filterEvent,
    });
  });
});

function apiError(statusCode: number): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message: "refused",
    path: "/apps/a/keywords",
    timestamp: new Date().toISOString(),
    ...(statusCode === 429
      ? {
          retryAfterSeconds: 4,
          rateLimit: {
            window: "minute",
            rateClass: "read",
            plan: "trial",
            limit: 300,
            resetSeconds: 4,
            upgradeTo: "indie",
          },
        }
      : {}),
  });
}

describe("filterEvent", () => {
  const event = eventWith({
    transaction: "/apps/clx8s9k2l0000abcdefghijkl/keywords",
  });

  it.each([
    ["a spent plan budget", apiError(429)],
    ["a deleted record", apiError(404)],
    ["an ended trial", apiError(402)],
    ["a closed session", apiError(401)],
    [
      "a refusal that crossed a bundle as its digest",
      Object.assign(new Error("refused"), { digest: apiError(429).digest }),
    ],
    [
      "a render the visitor left",
      new Error("The destination stream closed early."),
    ],
  ])("drops %s", (_reason, error) => {
    expect(filterEvent(event, { originalException: error })).toBeNull();
  });

  it.each([
    ["a render failure", new Error("cannot read properties of undefined")],
    ["an api failure", apiError(500)],
    ["a gateway that gave up on the api", apiError(504)],
    ["a refusal no page explains", apiError(400)],
    ["no exception at all", undefined],
  ])("keeps %s and scrubs it", (_reason, error) => {
    expect(filterEvent(event, { originalException: error })).toEqual(
      scrubEvent(event),
    );
  });
});

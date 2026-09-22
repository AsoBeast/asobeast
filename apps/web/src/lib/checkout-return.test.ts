import { describe, expect, it } from "vitest";
import {
  checkoutReturned,
  checkoutSessionId,
  urlWithoutCheckout,
} from "./checkout-return";

describe("checkoutReturned", () => {
  it("recognises the return Stripe sends the customer back with", () => {
    expect(checkoutReturned("?checkout=complete")).toBe(true);
  });

  it("ignores a page nobody reached from checkout", () => {
    expect(checkoutReturned("")).toBe(false);
    expect(checkoutReturned("?tab=plan")).toBe(false);
  });

  it("ignores a checkout the customer abandoned", () => {
    expect(checkoutReturned("?checkout=cancelled")).toBe(false);
  });
});

describe("checkoutSessionId", () => {
  it("reads the session stripe substituted into the return", () => {
    expect(checkoutSessionId("?checkout=complete&session_id=cs_test_1")).toBe(
      "cs_test_1",
    );
  });

  it("answers nothing for a return that carries no session", () => {
    expect(checkoutSessionId("?checkout=complete")).toBeUndefined();
  });

  it("answers nothing for an empty session, which the api would refuse", () => {
    expect(checkoutSessionId("?checkout=complete&session_id=")).toBeUndefined();
  });
});

describe("urlWithoutCheckout", () => {
  it("strips both checkout parameters and keeps the rest", () => {
    expect(
      urlWithoutCheckout(
        "/settings",
        "?tab=plan&checkout=complete&session_id=cs_test_1",
      ),
    ).toBe("/settings?tab=plan");
  });

  it("drops the marker so a reload does not reconcile again", () => {
    expect(urlWithoutCheckout("/settings", "?checkout=complete")).toBe(
      "/settings",
    );
  });

  it("keeps every other parameter the page was opened with", () => {
    expect(urlWithoutCheckout("/settings", "?checkout=complete&tab=plan")).toBe(
      "/settings?tab=plan",
    );
  });

  it("leaves a url that never carried the marker alone", () => {
    expect(urlWithoutCheckout("/settings", "?tab=plan")).toBe(
      "/settings?tab=plan",
    );
  });
});

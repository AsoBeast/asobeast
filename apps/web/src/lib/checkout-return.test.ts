import { describe, expect, it } from "vitest";
import { checkoutReturned, urlWithoutCheckout } from "./checkout-return";

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

describe("urlWithoutCheckout", () => {
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

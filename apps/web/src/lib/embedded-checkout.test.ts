import { describe, expect, it } from "vitest";
import { checkoutUiFor, sessionKeyOf } from "./embedded-checkout";

describe("embedded checkout", () => {
  it("keys a mount on the price, so a plan or interval change is a new session", () => {
    expect(sessionKeyOf("price_indie_month")).toBe(
      "stripe-checkout-price_indie_month",
    );
    expect(sessionKeyOf("price_indie_year")).not.toBe(
      sessionKeyOf("price_indie_month"),
    );
  });

  it("embeds checkout only when the catalog names a publishable key", () => {
    expect(
      checkoutUiFor({ enabled: true, prices: [], publishableKey: "pk_test_1" }),
    ).toBe("embedded");
    expect(checkoutUiFor({ enabled: true, prices: [] })).toBe("hosted");
    expect(
      checkoutUiFor({
        enabled: false,
        prices: [],
        publishableKey: "pk_test_1",
      }),
    ).toBe("hosted");
    expect(checkoutUiFor(undefined)).toBe("hosted");
  });
});

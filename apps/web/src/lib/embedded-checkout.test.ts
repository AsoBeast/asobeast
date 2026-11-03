import { describe, expect, it } from "vitest";
import {
  checkoutThemeOf,
  checkoutUiFor,
  openAfterPrevious,
  sessionKeyOf,
} from "./embedded-checkout";

describe("embedded checkout", () => {
  it("keys a mount on the price and the theme, so either change is a new session", () => {
    expect(sessionKeyOf("price_indie_month", "light")).toBe(
      "stripe-checkout-price_indie_month-light",
    );
    expect(sessionKeyOf("price_indie_month", "dark")).not.toBe(
      sessionKeyOf("price_indie_month", "light"),
    );
    expect(sessionKeyOf("price_indie_year", "dark")).not.toBe(
      sessionKeyOf("price_indie_month", "dark"),
    );
  });

  it("brands the checkout dark only for the dark theme", () => {
    expect(checkoutThemeOf("dark")).toBe("dark");
    expect(checkoutThemeOf("light")).toBe("light");
    expect(checkoutThemeOf("system")).toBe("light");
    expect(checkoutThemeOf(undefined)).toBe("light");
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

  it("opens each checkout only after the one before it settled, failed or not", async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const first = openAfterPrevious(
      () =>
        new Promise<string>((_, reject) => {
          order.push("first started");
          releaseFirst = () => reject(new Error("refused"));
        }),
    );
    const second = openAfterPrevious(async () => {
      order.push("second started");
      return "second";
    });

    await Promise.resolve();
    expect(order).toEqual(["first started"]);
    releaseFirst();

    await expect(first).rejects.toThrow("refused");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first started", "second started"]);
  });
});

import { describe, expect, it } from "vitest";
import { storeUrl } from "./store-url";

describe("storeUrl", () => {
  it("opens the listing in the chart's storefront", () => {
    expect(storeUrl("APP_STORE", "123", "de")).toBe(
      "https://apps.apple.com/de/app/id123",
    );
    expect(storeUrl("GOOGLE_PLAY", "com.example.app", "de")).toBe(
      "https://play.google.com/store/apps/details?id=com.example.app&gl=de",
    );
  });
});

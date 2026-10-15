import { describe, expect, it } from "vitest";
import { consoleHref, consoleLabel } from "./store-console";

describe("consoleHref", () => {
  it("links an app store app to its ratings in app store connect", () => {
    expect(consoleHref("APP_STORE", "6657987209")).toBe(
      "https://appstoreconnect.apple.com/apps/6657987209/distribution/activity/ios/ratingsResponses",
    );
  });

  it("links a google play app to the console", () => {
    expect(consoleHref("GOOGLE_PLAY", "com.bitwise.tomatoclock")).toBe(
      "https://play.google.com/console/",
    );
  });
});

describe("consoleLabel", () => {
  it("names the console", () => {
    expect(consoleLabel("APP_STORE")).toBe("App Store Connect");
    expect(consoleLabel("GOOGLE_PLAY")).toBe("Play Console");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../../next.config";
import { version } from "../../../package.json";
import { appVersionLabel, releaseNotesUrl } from "./app-version";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appVersionLabel", () => {
  it("labels the version the build inlined", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.2.0");

    expect(appVersionLabel()).toBe("v1.2.0");
  });

  it.each([undefined, ""])(
    "stays silent rather than label a missing version (%o)",
    (missing) => {
      vi.stubEnv("NEXT_PUBLIC_APP_VERSION", missing);

      expect(appVersionLabel()).toBeNull();
    },
  );

  it("is inlined from the version Release Please bumps", () => {
    expect(nextConfig.env?.NEXT_PUBLIC_APP_VERSION).toBe(version);
  });
});

describe("releaseNotesUrl", () => {
  it("opens the release Release Please tagged with the label", () => {
    expect(releaseNotesUrl("v1.11.0")).toBe(
      "https://github.com/AsoBeast/asobeast/releases/tag/v1.11.0",
    );
  });
});

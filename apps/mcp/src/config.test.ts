import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const TOKEN = `asob_${"a".repeat(48)}`;

function configWith(apiUrl: string | undefined) {
  return loadConfig({ ASOBEAST_API_TOKEN: TOKEN, ASOBEAST_API_URL: apiUrl });
}

describe("loadConfig api url", () => {
  it.each(["app.asobeast.com/api/backend", "ftp://host/api/backend"])(
    "names the variable and the form it needs for %j",
    (apiUrl) => {
      expect(() => configWith(apiUrl)).toThrowError(ConfigError);
      expect(() => configWith(apiUrl)).toThrowError(
        /ASOBEAST_API_URL.*https:\/\//,
      );
    },
  );

  it.each(["", "   ", undefined])(
    "treats %j as unset and uses the default",
    (apiUrl) => {
      expect(configWith(apiUrl).apiUrl).toBe("http://localhost:4000");
    },
  );

  it("drops a trailing slash", () => {
    expect(configWith("https://host/api/backend/").apiUrl).toBe(
      "https://host/api/backend",
    );
  });
});

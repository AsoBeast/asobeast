import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, travelsInClearText } from "./config.js";

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

  it.each(["https://host/api/backend/mcp", "https://host/api/backend/mcp/"])(
    "names the rest api url when given the mcp endpoint %j",
    (apiUrl) => {
      expect(() => configWith(apiUrl)).toThrowError(ConfigError);
      expect(() => configWith(apiUrl)).toThrowError(
        /set it to https:\/\/host\/api\/backend\.$/,
      );
    },
  );

  it("drops a trailing slash", () => {
    expect(configWith("https://host/api/backend/").apiUrl).toBe(
      "https://host/api/backend",
    );
  });
});

describe("loadConfig api token", () => {
  function tokenFrom(raw: string) {
    return loadConfig({ ASOBEAST_API_TOKEN: raw }).token;
  }

  it.each([
    `Bearer ${TOKEN}`,
    `bearer ${TOKEN}`,
    `"${TOKEN}"`,
    `'${TOKEN}'`,
    `  ${TOKEN}\n`,
  ])("reads the token from %j", (raw) => {
    expect(tokenFrom(raw)).toBe(TOKEN);
  });

  it.each(["ghp_abc", "Bearer "])(
    "refuses %j as a personal api token",
    (raw) => {
      expect(() => tokenFrom(raw)).toThrowError(ConfigError);
      expect(() => tokenFrom(raw)).toThrowError(/asob_/);
    },
  );
});

describe("travelsInClearText", () => {
  it.each([
    "http://app.asobeast.com/api/backend",
    "http://192.168.1.10:3001/api/backend",
    "http://api:4000",
  ])("warns for %s", (apiUrl) => {
    expect(travelsInClearText(apiUrl)).toBe(true);
  });

  it.each([
    "https://app.asobeast.com/api/backend",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://[::1]:4000",
    "http://asobeast.localhost",
  ])("stays quiet for %s", (apiUrl) => {
    expect(travelsInClearText(apiUrl)).toBe(false);
  });
});

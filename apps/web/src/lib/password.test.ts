import { describe, expect, it } from "vitest";
import {
  passwordError,
  PASSWORD_MOSTLY_SPACES,
  PASSWORD_TOO_LONG,
  PASSWORD_TOO_SHORT,
} from "./password";

describe("passwordError", () => {
  it("accepts a password that meets the rule", () => {
    expect(passwordError("correct horse")).toBeNull();
  });

  it("asks for more characters when the password is too short", () => {
    expect(passwordError("short")).toBe(PASSWORD_TOO_SHORT);
    expect(PASSWORD_TOO_SHORT).toBe("Use at least 10 characters.");
  });

  it("asks for fewer characters when the password is too long", () => {
    expect(passwordError("a".repeat(129))).toBe(PASSWORD_TOO_LONG);
    expect(PASSWORD_TOO_LONG).toBe("Use 128 characters or fewer.");
  });

  it.each([" ".repeat(10), "a         b"])(
    "says spaces do not count for %j",
    (password) => {
      expect(passwordError(password)).toBe(PASSWORD_MOSTLY_SPACES);
    },
  );
});

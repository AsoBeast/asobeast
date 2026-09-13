import { describe, expect, it } from "vitest";
import { PASSWORD_RULE } from "@asobeast/shared";
import { passwordError, PASSWORD_LENGTH_ERROR } from "./password";

describe("passwordError", () => {
  it("accepts a password that meets the rule", () => {
    expect(passwordError("correct horse")).toBeNull();
  });

  it.each(["short", "a".repeat(129)])(
    "names the length limits for %j",
    (password) => {
      expect(passwordError(password)).toBe(PASSWORD_LENGTH_ERROR);
    },
  );

  it.each([" ".repeat(10), "a         b"])(
    "states the rule for %j",
    (password) => {
      expect(passwordError(password)).toBe(PASSWORD_RULE);
    },
  );
});

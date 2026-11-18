import { describe, expect, it } from "vitest";
import { errorReference } from "./error-reference";

describe("errorReference", () => {
  it("returns the digest the framework stamped on a server error", () => {
    expect(errorReference({ digest: "836429522" })).toBe("836429522");
    expect(errorReference({ digest: " 3f9a1c20 " })).toBe("3f9a1c20");
  });

  it("returns nothing for an error without a digest", () => {
    expect(errorReference({})).toBeNull();
    expect(errorReference({ digest: "" })).toBeNull();
  });

  it("never shows a digest that carries an api answer", () => {
    expect(errorReference({ digest: "ASOBEAST_API_ERROR;500;;;1" })).toBeNull();
  });

  it("never shows a digest long enough to be a message", () => {
    expect(errorReference({ digest: "a".repeat(41) })).toBeNull();
  });
});

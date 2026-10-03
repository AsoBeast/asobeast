import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("does not describe asobeast as self hosted", () => {
    expect(manifest().description).not.toMatch(/self hosted/i);
  });
});

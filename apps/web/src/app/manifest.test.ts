import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("does not describe asobeast as self hosted", () => {
    expect(manifest().description).not.toMatch(/self hosted/i);
  });

  it("names the installed app AsoBeast", () => {
    const { name, short_name } = manifest();

    expect({ name, short_name }).toEqual({
      name: "AsoBeast",
      short_name: "AsoBeast",
    });
  });
});

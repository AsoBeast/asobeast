import { describe, expect, it, vi } from "vitest";
import manifest from "./manifest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    key === "description" ? "Open-source App Store Optimization toolkit" : key,
}));

describe("manifest", () => {
  it("does not describe asobeast as self-hosted", async () => {
    expect((await manifest()).description).not.toMatch(/self[ -]hosted/i);
  });

  it("names the installed app AsoBeast", async () => {
    const { name, short_name } = await manifest();

    expect({ name, short_name }).toEqual({
      name: "AsoBeast",
      short_name: "AsoBeast",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { loadCardIcon } from "./card-icon";

vi.mock("next/image", () => ({
  getImageProps: () => {
    throw new Error("Invalid src prop");
  },
}));

describe("loadCardIcon", () => {
  it("answers no icon when the image address cannot be built", async () => {
    await expect(
      loadCardIcon("https://example.invalid/icon.png"),
    ).resolves.toBeNull();
  });

  it("answers no icon for an app without one", async () => {
    await expect(loadCardIcon(null)).resolves.toBeNull();
  });
});

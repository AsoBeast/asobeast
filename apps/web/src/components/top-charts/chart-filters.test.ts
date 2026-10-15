import { describe, expect, it } from "vitest";
import { activeFilterCount, showsDevice } from "./chart-filters";

describe("activeFilterCount", () => {
  it("counts nothing for the default chart", () => {
    expect(activeFilterCount({ country: "us", genre: "overall" }, "1d")).toBe(
      0,
    );
  });

  it("counts each filter away from its default", () => {
    expect(activeFilterCount({ country: "de", genre: "overall" }, "1d")).toBe(
      1,
    );
    expect(activeFilterCount({ country: "us", genre: "7012" }, "1d")).toBe(1);
    expect(activeFilterCount({ country: "us", genre: "overall" }, "7d")).toBe(
      1,
    );
    expect(activeFilterCount({ country: "de", genre: "7012" }, "30d")).toBe(3);
  });
});

describe("showsDevice", () => {
  it("hides the device of a store that charts one device", () => {
    expect(showsDevice("APP_STORE")).toBe(false);
    expect(showsDevice("GOOGLE_PLAY")).toBe(false);
  });
});

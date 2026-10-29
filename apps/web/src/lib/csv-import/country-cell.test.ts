import { describe, expect, it } from "vitest";
import { countryFromCell } from "./country-cell";

describe("countryFromCell", () => {
  it.each([
    ["us", "us"],
    ["PL", "PL"],
    [" gb ", "gb"],
  ])("U-CTRY-01 leaves the code %j as %j", (cell, expected) => {
    expect(countryFromCell(cell)).toBe(expected);
  });

  it.each([
    ["Poland", "pl"],
    ["united states", "us"],
    ["United Kingdom", "gb"],
    ["Antigua and Barbuda", "ag"],
    ["Antigua & Barbuda", "ag"],
    ["Cote d'Ivoire", "ci"],
    ["Côte d’Ivoire", "ci"],
    ["Türkiye", "tr"],
    ["Turkey", "tr"],
    ["Czech Republic", "cz"],
    ["Myanmar", "mm"],
    ["USA", "us"],
  ])("U-CTRY-02 reads the name %j as %j", (cell, expected) => {
    expect(countryFromCell(cell)).toBe(expected);
  });

  it.each([
    ["🇵🇱", "pl"],
    ["🇵🇱 Poland", "pl"],
    ["🇺🇸 United States", "us"],
    ["🇦🇪 United Arab Emirates", "ae"],
  ])("U-CTRY-03 reads the flag in %j as %j", (cell, expected) => {
    expect(countryFromCell(cell)).toBe(expected);
  });

  it.each([["Atlantis"], ["🇵"], ["12"], [""]])(
    "U-CTRY-04 hands %j on as written for the server to refuse",
    (cell) => {
      expect(countryFromCell(cell)).toBe(cell.trim());
    },
  );
});

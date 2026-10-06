import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCountry, formatDateTime } from "./format";

const REGION_NAMES_OF_OTHER_ENGINES: Record<string, string> = {
  CN: "China mainland",
  FK: "Falkland Islands (Islas Malvinas)",
  GS: "So. Georgia & So. Sandwich Isl.",
  HK: "Hong Kong",
  IO: "Chagos Archipelago",
  MO: "Macao",
  PS: "Palestine",
};

function useRegionNamesOfOtherEngines() {
  const original = Intl.DisplayNames.prototype.of;
  vi.spyOn(Intl.DisplayNames.prototype, "of").mockImplementation(function (
    this: Intl.DisplayNames,
    code,
  ) {
    return REGION_NAMES_OF_OTHER_ENGINES[code] ?? original.call(this, code);
  });
}

const formatDescriptor = Object.getOwnPropertyDescriptor(
  Intl.DateTimeFormat.prototype,
  "format",
);

function joinDateAndTimeWithAt() {
  const read = formatDescriptor?.get;
  if (!read) throw new Error("Intl.DateTimeFormat has no format getter");
  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
    configurable: true,
    get(this: Intl.DateTimeFormat) {
      const format = read.call(this) as (date?: Date) => string;
      const { dateStyle, timeStyle } = this.resolvedOptions();
      return (date?: Date) =>
        dateStyle && timeStyle
          ? format(date).replace(/, (?=\d{1,2}:)/, " at ")
          : format(date);
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (formatDescriptor) {
    Object.defineProperty(
      Intl.DateTimeFormat.prototype,
      "format",
      formatDescriptor,
    );
  }
});

describe("formatDateTime on an engine that joins a date and a time with at", () => {
  it.each([
    ["2026-10-06T03:00:00.000Z", "Oct 6, 2026, 3:00 AM UTC"],
    ["2026-10-05T10:56:00.000Z", "Oct 5, 2026, 10:56 AM UTC"],
    ["2026-01-01T00:00:00.000Z", "Jan 1, 2026, 12:00 AM UTC"],
  ])("renders %s as %s", (value, expected) => {
    joinDateAndTimeWithAt();

    expect(formatDateTime(value)).toBe(expected);
  });
});

describe("formatCountry on an engine that words regions differently", () => {
  it.each([
    ["cn", "China"],
    ["fk", "Falkland Islands"],
    ["gs", "South Georgia & South Sandwich Islands"],
    ["hk", "Hong Kong"],
    ["io", "British Indian Ocean Territory"],
    ["mo", "Macao"],
    ["ps", "Palestinian Territories"],
    ["us", "United States"],
  ])("names %s as %s", (code, expected) => {
    useRegionNamesOfOtherEngines();

    expect(formatCountry(code)).toBe(expected);
  });
});

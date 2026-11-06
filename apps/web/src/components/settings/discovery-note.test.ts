import { describe, expect, it } from "vitest";
import { discoveryNote } from "./discovery-note";

describe("discoveryNote", () => {
  it("says nothing without weekly discovery", () => {
    expect(discoveryNote(undefined)).toBeNull();
    expect(discoveryNote({ checksPerWeek: 0, requestsPerWeek: 0 })).toBeNull();
  });

  it("names the weekly searches and requests", () => {
    expect(discoveryNote({ checksPerWeek: 80, requestsPerWeek: 240 })).toBe(
      "Keyword discovery adds up to 80 searches a week, about 240 requests, outside this daily total.",
    );
    expect(discoveryNote({ checksPerWeek: 1200, requestsPerWeek: 4800 })).toBe(
      "Keyword discovery adds up to 1,200 searches a week, about 4,800 requests, outside this daily total.",
    );
  });

  it("names a single search and request", () => {
    expect(discoveryNote({ checksPerWeek: 1, requestsPerWeek: 1 })).toBe(
      "Keyword discovery adds up to 1 search a week, about 1 request, outside this daily total.",
    );
  });
});

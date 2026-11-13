import { describe, expect, it } from "vitest";
import type { CompetitorItem } from "@asobeast/shared";
import { snapshotParts } from "./competitor-snapshot";

type Snapshot = NonNullable<CompetitorItem["latestSnapshot"]>;

const snapshot = (overrides: Partial<Snapshot>): Snapshot => ({
  id: "snap",
  title: "Rival Focus",
  subtitle: null,
  summary: null,
  ratingAvg: 4.5,
  ratingCount: 12000,
  installs: null,
  price: 0,
  version: "2.1.0",
  capturedAt: "2026-11-10T03:00:00.000Z",
  ...overrides,
});

describe("snapshotParts", () => {
  it("lists rating with its count, price and version", () => {
    expect(snapshotParts(snapshot({}))).toEqual([
      "★ 4.5 (12,000)",
      "Free",
      "v2.1.0",
    ]);
  });

  it("writes a price in its storefront currency", () => {
    const [, price] = snapshotParts(snapshot({ price: 9.99, currency: "PLN" }));
    expect(price).toMatch(/^PLN\s9\.99$/);
  });

  it("leaves out what the snapshot does not carry", () => {
    expect(
      snapshotParts(
        snapshot({ ratingCount: null, price: null, version: null }),
      ),
    ).toEqual(["★ 4.5"]);
  });

  it("says so when nothing was captured", () => {
    expect(snapshotParts(null)).toEqual(["Not captured yet"]);
    expect(
      snapshotParts(snapshot({ ratingAvg: null, price: null, version: "" })),
    ).toEqual(["Not captured yet"]);
  });
});

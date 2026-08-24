import {
  METADATA_FIELDS,
  STORE_FIELD_LIMITS,
  SUPPORTED_STORES,
  type LintSeverity,
  type MetadataField,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  LINT_SEVERITY_LABEL,
  LINT_SEVERITY_VARIANT,
  METADATA_FIELD_LABELS,
} from "./metadata-display";

const SEVERITIES: LintSeverity[] = ["error", "warn", "info"];

const APPLE_ONLY_FIELDS: MetadataField[] = ["subtitle", "keywordField"];

describe("METADATA_FIELD_LABELS", () => {
  it.each(METADATA_FIELDS)("labels the field %s", (field) => {
    expect(METADATA_FIELD_LABELS[field]).toBeTruthy();
  });

  it("labels no field the editor does not know about", () => {
    expect(Object.keys(METADATA_FIELD_LABELS).sort()).toEqual(
      [...METADATA_FIELDS].sort(),
    );
  });

  it.each(SUPPORTED_STORES)("labels every field %s indexes", (store) => {
    const fields = Object.keys(STORE_FIELD_LIMITS[store]) as MetadataField[];
    for (const field of fields) {
      expect(METADATA_FIELD_LABELS[field]).toBeTruthy();
    }
  });
});

describe("store specific metadata fields", () => {
  it.each(APPLE_ONLY_FIELDS)("offers %s on the app store only", (field) => {
    expect(STORE_FIELD_LIMITS.APP_STORE[field]).toBeDefined();
    expect(STORE_FIELD_LIMITS.GOOGLE_PLAY[field]).toBeUndefined();
  });

  it("offers the indexed short description on google play only", () => {
    expect(STORE_FIELD_LIMITS.GOOGLE_PLAY.shortDescription).toEqual({
      limit: 80,
      indexed: true,
    });
    expect(STORE_FIELD_LIMITS.APP_STORE.shortDescription).toBeUndefined();
  });

  it("indexes the google play description while the app store does not", () => {
    expect(STORE_FIELD_LIMITS.GOOGLE_PLAY.description?.indexed).toBe(true);
    expect(STORE_FIELD_LIMITS.APP_STORE.description?.indexed).toBe(false);
  });
});

describe("LINT_SEVERITY_VARIANT", () => {
  it.each(SEVERITIES)("maps the severity %s to a badge variant", (severity) => {
    expect(LINT_SEVERITY_VARIANT[severity]).toBeTruthy();
  });

  it("maps each severity to a distinct variant", () => {
    const variants = SEVERITIES.map(
      (severity) => LINT_SEVERITY_VARIANT[severity],
    );
    expect(new Set(variants).size).toBe(SEVERITIES.length);
  });

  it("escalates an error to the destructive variant", () => {
    expect(LINT_SEVERITY_VARIANT.error).toBe("destructive");
  });
});

describe("LINT_SEVERITY_LABEL", () => {
  it("gives every severity a text channel so colour is not the only signal", () => {
    for (const severity of SEVERITIES) {
      expect(LINT_SEVERITY_LABEL[severity]).toBeTruthy();
    }
    expect(new Set(Object.values(LINT_SEVERITY_LABEL)).size).toBe(
      SEVERITIES.length,
    );
  });
});

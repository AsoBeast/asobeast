import type { LintSeverity, MetadataField } from "@asobeast/shared";

export const METADATA_FIELD_LABELS: Record<MetadataField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  description: "Description",
  promotionalText: "Promotional text",
  whatsNew: "What's New",
  shortDescription: "Short description",
};

export const LINT_SEVERITY_VARIANT: Record<
  LintSeverity,
  "destructive" | "warning" | "info"
> = {
  error: "destructive",
  warn: "warning",
  info: "info",
};

export const LINT_SEVERITY_LABEL: Record<LintSeverity, string> = {
  error: "Error",
  warn: "Warning",
  info: "Info",
};

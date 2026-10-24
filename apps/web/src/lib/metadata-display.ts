import {
  CHANGE_FIELD_LABELS,
  type LintSeverity,
  type MetadataField,
} from "@asobeast/shared";

export const METADATA_FIELD_LABELS: Record<MetadataField, string> = {
  title: CHANGE_FIELD_LABELS.title,
  subtitle: CHANGE_FIELD_LABELS.subtitle,
  keywordField: "Keyword field",
  description: CHANGE_FIELD_LABELS.description,
  promotionalText: "Promotional text",
  whatsNew: CHANGE_FIELD_LABELS.whatsNew,
  shortDescription: CHANGE_FIELD_LABELS.summary,
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

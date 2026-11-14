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

export const LINT_SEVERITY_TONE: Record<LintSeverity, string> = {
  error: "text-signal-down",
  warn: "text-warning",
  info: "text-muted-foreground",
};

export const LINT_SEVERITY_LABEL: Record<LintSeverity, string> = {
  error: "Error",
  warn: "Warning",
  info: "Info",
};

import type { MessageTranslator } from "@/i18n/translator";

export const ADMIN_ROOT = "/admin";

export const ADMIN_SECTIONS = [
  { segment: "", labelKey: "nav.overview" },
  { segment: "conversion", labelKey: "nav.conversion" },
  { segment: "capacity", labelKey: "nav.capacity" },
  { segment: "workspaces", labelKey: "nav.workspaces" },
  { segment: "users", labelKey: "nav.users" },
  { segment: "apps", labelKey: "nav.apps" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type AdminSegment = AdminSection["segment"];

const ADMIN_PATH = /^\/admin(?:\/([^/]+))?\/?$/;

export function adminHref(segment: AdminSegment): string {
  return segment ? `${ADMIN_ROOT}/${segment}` : ADMIN_ROOT;
}

export function workspaceListHref(
  segment: AdminSegment,
  workspaceId: string,
): string {
  return `${adminHref(segment)}?workspace=${encodeURIComponent(workspaceId)}`;
}

export function adminSectionFrom(pathname: string): AdminSection | null {
  const match = ADMIN_PATH.exec(pathname);
  if (!match) return null;
  const segment = match[1] ?? "";
  return ADMIN_SECTIONS.find((section) => section.segment === segment) ?? null;
}

export function adminSectionLabel(
  section: AdminSection,
  translator: MessageTranslator,
): string {
  return translator(section.labelKey);
}

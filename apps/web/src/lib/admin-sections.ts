export const ADMIN_ROOT = "/admin";

export const ADMIN_SECTIONS = [
  { segment: "", label: "Overview" },
  { segment: "capacity", label: "Capacity" },
  { segment: "workspaces", label: "Workspaces" },
  { segment: "users", label: "Users" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type AdminSegment = AdminSection["segment"];

const ADMIN_PATH = /^\/admin(?:\/([^/]+))?\/?$/;

export function adminHref(segment: AdminSegment): string {
  return segment ? `${ADMIN_ROOT}/${segment}` : ADMIN_ROOT;
}

export function adminSectionFrom(pathname: string): AdminSection | null {
  const match = ADMIN_PATH.exec(pathname);
  if (!match) return null;
  const segment = match[1] ?? "";
  return ADMIN_SECTIONS.find((section) => section.segment === segment) ?? null;
}

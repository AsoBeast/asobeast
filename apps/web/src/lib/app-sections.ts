export const APP_SECTIONS = [
  { segment: "", label: "Overview" },
  { segment: "actions", label: "Actions" },
  { segment: "keywords", label: "Keywords" },
  { segment: "rankings", label: "Rankings" },
  { segment: "competitors", label: "Competitors" },
  { segment: "changes", label: "Changes" },
  { segment: "reviews", label: "Reviews" },
  { segment: "audit", label: "Audit" },
  { segment: "metadata", label: "Metadata" },
] as const;

export type AppSectionSegment = (typeof APP_SECTIONS)[number]["segment"];

export interface AppRoute {
  id: string;
  segment: string;
}

export function appRouteFrom(pathname: string): AppRoute | null {
  const match = /^\/apps\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;
  return { id: match[1], segment: match[2] ?? "" };
}

export function sectionHref(appId: string, segment: string): string {
  return segment ? `/apps/${appId}/${segment}` : `/apps/${appId}`;
}

export function isSectionActive(
  pathname: string,
  appId: string,
  segment: string,
): boolean {
  const route = appRouteFrom(pathname);
  return route !== null && route.id === appId && route.segment === segment;
}

export function equivalentSection(segment: string): AppSectionSegment {
  const known = APP_SECTIONS.find((section) => section.segment === segment);
  return known ? known.segment : "";
}

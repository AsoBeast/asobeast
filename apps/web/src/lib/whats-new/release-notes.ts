export const RELEASE_KINDS = ["new", "improved", "fixed"] as const;
export type ReleaseKind = (typeof RELEASE_KINDS)[number];

export interface ReleaseChange {
  kind: ReleaseKind;
  title: string;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly ReleaseChange[];
}

export type Version = readonly [number, number, number];

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)/;

export function parseVersion(label: string): Version | null {
  const match = VERSION.exec(label);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function releasesUpTo(
  releases: readonly Release[],
  running: string | null,
): readonly Release[] {
  const ceiling = running === null ? null : parseVersion(running);
  if (!ceiling) return releases;
  return releases.filter((release) => {
    const version = parseVersion(release.version);
    return version !== null && compareVersions(version, ceiling) <= 0;
  });
}

export function latestShown(
  releases: readonly Release[],
  running: string | null,
): string | null {
  return releasesUpTo(releases, running)[0]?.version ?? null;
}

export function hasUnseenRelease(
  latest: string | null,
  seen: string | null | undefined,
): boolean {
  if (latest === null || seen === undefined) return false;
  const newest = parseVersion(latest);
  if (!newest) return false;
  const opened = seen === null ? null : parseVersion(seen);
  return opened === null || compareVersions(newest, opened) > 0;
}

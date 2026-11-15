import {
  compareVersions,
  parseVersion,
  type Release,
  type ReleaseKind,
} from "@/lib/whats-new/release-notes";

export const RELEASE_KIND_LABELS: Record<ReleaseKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};

export const KIND_SHOWN: Record<ReleaseKind, number> = {
  new: 5,
  improved: 3,
  fixed: 3,
};

const SENTENCE_END = /^.+?[.!?](?=\s|$)/;

export const releaseAnchor = (version: string) =>
  `release-${version.replaceAll(".", "-")}`;

export function firstSentence(text: string): string {
  return SENTENCE_END.exec(text)?.[0] ?? text;
}

export function unreadOnArrival(
  releases: readonly Release[],
  seen: string | null,
): ReadonlySet<string> {
  if (seen === null) {
    return new Set(releases.slice(0, 1).map((release) => release.version));
  }
  const opened = parseVersion(seen);
  return new Set(
    releases
      .filter((release) => {
        const version = parseVersion(release.version);
        return (
          opened !== null &&
          version !== null &&
          compareVersions(version, opened) > 0
        );
      })
      .map((release) => release.version),
  );
}

export function openOnArrival(
  releases: readonly Release[],
  seen: string | null,
  linked: string,
): ReadonlySet<string> {
  const open = new Set(unreadOnArrival(releases, seen));
  releases.forEach((release, index) => {
    if (index === 0 || releaseAnchor(release.version) === linked) {
      open.add(release.version);
    }
  });
  return open;
}

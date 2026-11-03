import type { Release } from "@/lib/whats-new/release-notes";
import { ReleaseEntry } from "./ReleaseEntry";

export function ReleaseTimeline({
  releases,
}: {
  releases: readonly Release[];
}) {
  if (releases.length === 0) {
    return (
      <p className="text-body text-muted-foreground">No release notes yet.</p>
    );
  }

  return (
    <ol aria-label="Releases" className="flex flex-col">
      {releases.map((release, index) => (
        <ReleaseEntry
          key={release.version}
          release={release}
          latest={index === 0}
        />
      ))}
    </ol>
  );
}

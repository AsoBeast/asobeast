export interface SerpSnapshotDay {
  date: string;
  entries: { position: number; storeAppId: string; title: string }[];
}

export interface SerpEntrant {
  date: string;
  position: number;
  storeAppId: string;
  title: string;
}

export function detectEntrants(snapshots: SerpSnapshotDay[]): SerpEntrant[] {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const entrants: SerpEntrant[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = new Set(
      ordered[i - 1].entries.map((entry) => entry.storeAppId),
    );
    for (const entry of ordered[i].entries) {
      if (!previous.has(entry.storeAppId)) {
        entrants.push({
          date: ordered[i].date,
          position: entry.position,
          storeAppId: entry.storeAppId,
          title: entry.title,
        });
      }
    }
  }
  return entrants;
}

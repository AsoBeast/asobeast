const KEY = "flex items-center gap-1.5";

export function RankingKey({
  changes,
  annotations,
}: {
  changes: boolean;
  annotations: boolean;
}) {
  if (!changes && !annotations) return null;
  return (
    <ul
      aria-label="Chart marks"
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {changes ? (
        <li className={KEY}>
          <svg aria-hidden width="10" height="8" viewBox="0 0 10 8">
            <path d="M1 8h8L5 1z" fill="var(--faint-foreground)" />
          </svg>
          <span>Listing change</span>
        </li>
      ) : null}
      {annotations ? (
        <li className={KEY}>
          <svg aria-hidden width="16" height="8" viewBox="0 0 16 8">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="var(--info)"
              strokeDasharray="6 3"
            />
          </svg>
          <span>Annotation</span>
        </li>
      ) : null}
    </ul>
  );
}

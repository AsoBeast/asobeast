export function RowCount({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  return (
    <p className="text-body text-muted-foreground" aria-live="polite">
      <span className="numeric font-mono font-medium text-foreground">
        {shown}
      </span>
      {" of "}
      <span className="numeric font-mono font-medium text-foreground">
        {total}
      </span>{" "}
      {total === 1 ? noun : `${noun}s`}
    </p>
  );
}

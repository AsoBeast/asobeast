export function DeveloperLine({ developer }: { developer: string | null }) {
  if (!developer) return null;
  return (
    <span dir="auto" className="truncate text-caption text-muted-foreground">
      {developer}
    </span>
  );
}

export function StoreButton({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-4 py-1 text-dense font-semibold text-foreground">
      {label}
    </span>
  );
}

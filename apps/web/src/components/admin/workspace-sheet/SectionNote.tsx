export function SectionNote({ children }: { children: string }) {
  return <p className="text-caption text-muted-foreground">{children}</p>;
}

export function SectionEmpty({ children }: { children: string }) {
  return (
    <p className="py-4 text-center text-dense text-muted-foreground">
      {children}
    </p>
  );
}

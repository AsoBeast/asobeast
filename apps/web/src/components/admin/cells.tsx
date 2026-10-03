export const NUMBER_SORT = {
  sortFn: "basic",
  sortDescFirst: true,
} as const;

export function WorkspaceName({
  name,
  workspaceId,
}: {
  name: string;
  workspaceId: string;
}) {
  return (
    <div className="flex max-w-56 min-w-0 flex-col">
      <span className="truncate font-medium">{name}</span>
      <span
        className="truncate text-caption text-muted-foreground"
        translate="no"
      >
        {workspaceId}
      </span>
    </div>
  );
}

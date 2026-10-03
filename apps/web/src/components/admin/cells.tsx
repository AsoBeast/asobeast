import Link from "next/link";

export const NUMBER_SORT = {
  sortFn: "basic",
  sortDescFirst: true,
} as const;

export function WorkspaceName({
  name,
  workspaceId,
  href,
  title,
}: {
  name: string;
  workspaceId: string;
  href?: string;
  title?: string;
}) {
  return (
    <div className="flex max-w-56 min-w-0 flex-col">
      {href ? (
        <Link
          href={href}
          title={title}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="truncate font-medium">{name}</span>
      )}
      <span
        className="truncate text-caption text-muted-foreground"
        translate="no"
      >
        {workspaceId}
      </span>
    </div>
  );
}

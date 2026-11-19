import Link from "next/link";

export const NUMBER_SORT = {
  sortFn: "basic",
  sortDescFirst: true,
} as const;

type WorkspaceOpener =
  { href?: string; onOpen?: never } | { href?: never; onOpen: () => void };

function NameLabel({
  name,
  workspaceId,
  href,
  onOpen,
  title,
}: {
  name: string;
  workspaceId: string;
  title?: string;
} & WorkspaceOpener) {
  if (onOpen) {
    return (
      <button
        type="button"
        data-workspace-sheet={workspaceId}
        onClick={onOpen}
        className="max-w-full truncate text-left font-medium link-underline"
      >
        {name}
      </button>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        title={title}
        className="max-w-full truncate font-medium link-underline"
      >
        {name}
      </Link>
    );
  }
  return <span className="max-w-full truncate font-medium">{name}</span>;
}

export function WorkspaceName(
  props: {
    name: string;
    workspaceId: string;
    title?: string;
  } & WorkspaceOpener,
) {
  return (
    <div className="flex max-w-56 min-w-0 flex-col items-start">
      <NameLabel {...props} />
      <span
        className="max-w-full truncate text-caption text-muted-foreground"
        translate="no"
      >
        {props.workspaceId}
      </span>
    </div>
  );
}

import type {
  LocalizationReader,
  LocalizationReadRole,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { READ_ROLE_LABELS } from "@/lib/app-localizations";
import { cn } from "@/lib/utils";

const ROLE_TONE = {
  default: "text-foreground",
  additional: "text-muted-foreground",
} as const satisfies Record<LocalizationReadRole, string>;

export function ReadRoleBadge({
  role,
  prefix,
}: {
  role: LocalizationReadRole;
  prefix?: string;
}) {
  const label = READ_ROLE_LABELS[role];
  return (
    <span className={cn("text-label whitespace-nowrap", ROLE_TONE[role])}>
      {prefix === undefined ? label : `${prefix} · ${label}`}
    </span>
  );
}

export function ReaderChips({
  readers,
}: {
  readers: readonly LocalizationReader[];
}) {
  if (readers.length === 0) {
    return <Badge variant="outline">Not read in your markets</Badge>;
  }
  return (
    <>
      {readers.map((reader) => (
        <ReadRoleBadge
          key={reader.country}
          role={reader.role}
          prefix={reader.country.toUpperCase()}
        />
      ))}
    </>
  );
}

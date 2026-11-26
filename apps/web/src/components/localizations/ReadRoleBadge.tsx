"use client";

import type {
  LocalizationReader,
  LocalizationReadRole,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { readRoleLabel } from "@/lib/app-localizations";

const ROLE_VARIANT = {
  default: "brand",
  additional: "secondary",
} as const satisfies Record<LocalizationReadRole, "brand" | "secondary">;

export function ReadRoleBadge({
  role,
  prefix,
}: {
  role: LocalizationReadRole;
  prefix?: string;
}) {
  const t = useTranslations("localizations");
  const label = readRoleLabel(role, t);
  return (
    <Badge variant={ROLE_VARIANT[role]}>
      {prefix === undefined ? label : `${prefix} · ${label}`}
    </Badge>
  );
}

export function ReaderChips({
  readers,
}: {
  readers: readonly LocalizationReader[];
}) {
  const t = useTranslations("localizations");
  if (readers.length === 0) {
    return <Badge variant="outline">{t("role.notRead")}</Badge>;
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

"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ConfirmDropsField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations("notifications");
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        aria-describedby={helpId}
        className="mt-0.5"
        onCheckedChange={(value) => onChange(value === true)}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id}>{t("confirmDrops.label")}</Label>
        <p id={helpId} className="text-caption text-muted-foreground">
          {t("confirmDrops.help")}
        </p>
      </div>
    </div>
  );
}

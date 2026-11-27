"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type SubjectButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "asChild" | "children" | "aria-label"
> & { icon: ReactNode; label: string; subject: string };

export function SubjectButton({
  icon,
  label,
  subject,
  ...props
}: SubjectButtonProps) {
  const t = useTranslations("ui");
  return (
    <Button variant="outline" size="sm" {...props}>
      {icon}
      {label}
      <span className="sr-only">{t("subjectOf", { subject })}</span>
    </Button>
  );
}

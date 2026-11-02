import type { ComponentProps, ReactNode } from "react";
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
  return (
    <Button variant="outline" size="sm" {...props}>
      {icon}
      {label}
      <span className="sr-only">{` of ${subject}`}</span>
    </Button>
  );
}

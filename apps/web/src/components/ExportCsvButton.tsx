import type { ComponentProps } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportCsvButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "asChild" | "children" | "aria-label"
> & { subject: string };

export function ExportCsvButton({ subject, ...props }: ExportCsvButtonProps) {
  return (
    <Button variant="outline" size="sm" {...props}>
      <Download aria-hidden />
      Export CSV
      <span className="sr-only">{` of ${subject}`}</span>
    </Button>
  );
}

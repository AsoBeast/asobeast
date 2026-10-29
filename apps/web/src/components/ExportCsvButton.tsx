import type { ComponentProps } from "react";
import { Download } from "lucide-react";
import { SubjectButton } from "@/components/SubjectButton";

type ExportCsvButtonProps = Omit<
  ComponentProps<typeof SubjectButton>,
  "icon" | "label"
>;

export function ExportCsvButton(props: ExportCsvButtonProps) {
  return (
    <SubjectButton
      icon={<Download aria-hidden />}
      label="Export CSV"
      {...props}
    />
  );
}

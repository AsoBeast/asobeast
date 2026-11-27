"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  [["j", "↓"], "shortcutNext"],
  [["k", "↑"], "shortcutPrevious"],
  [["Enter", "o"], "shortcutOpen"],
  [["d"], "shortcutDone"],
  [["s"], "shortcutSnooze"],
  [["Shift", "D"], "shortcutDismiss"],
  [["x"], "shortcutSelect"],
  [["/"], "shortcutSearch"],
  [["?"], "shortcutShow"],
  [["Esc"], "shortcutClear"],
] as const;

export function ActionShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("actions");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shortcutsTitle")}</DialogTitle>
          <DialogDescription>{t("shortcutsDescription")}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-body">
          <caption className="sr-only">{t("shortcutsCaption")}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("keys")}</th>
              <th scope="col">{t("shortcutAction")}</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([keys, labelKey]) => (
              <tr key={labelKey} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <span className="flex gap-1">
                    {keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded-sm border bg-muted px-1.5 font-mono text-caption"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </td>
                <td className="py-2">{t(labelKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}

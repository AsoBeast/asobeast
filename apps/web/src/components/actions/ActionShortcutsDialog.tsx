"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: ReadonlyArray<[string[], string]> = [
  [["j", "↓"], "Focus the next action"],
  [["k", "↑"], "Focus the previous action"],
  [["Enter", "o"], "Open the focused action"],
  [["d"], "Mark the focused action done"],
  [["s"], "Snooze the focused action"],
  [["Shift", "D"], "Dismiss the focused action"],
  [["x"], "Select the focused action"],
  [["/"], "Search actions"],
  [["?"], "Show these shortcuts"],
  [["Esc"], "Clear the selection"],
];

export function ActionShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Work the queue without the mouse. Shortcuts pause while you type or
            while a menu is open.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-body">
          <caption className="sr-only">
            Action Center keyboard shortcuts
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Keys</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([keys, label]) => (
              <tr key={label} className="border-b last:border-0">
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
                <td className="py-2">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}

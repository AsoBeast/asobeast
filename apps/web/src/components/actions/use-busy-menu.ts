import { useState } from "react";

export function useBusyMenu(busy: boolean): {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);
  return {
    open,
    onOpenChange: (next) => setOpen(next && !busy),
  };
}

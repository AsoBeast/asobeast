import { toast } from "sonner";

export const undoToast = (
  message: string,
  undo: () => void,
  description?: string,
) =>
  toast.success(message, {
    description,
    action: { label: "Undo", onClick: undo },
  });

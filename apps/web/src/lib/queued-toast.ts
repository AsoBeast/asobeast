import { toast } from "sonner";

export function queuedToast(message: string, description?: string): void {
  toast.info(`Queued · ${message}`, {
    description:
      description ??
      "The rate-limited worker runs it in the background. Results appear as the cache refetches.",
  });
}

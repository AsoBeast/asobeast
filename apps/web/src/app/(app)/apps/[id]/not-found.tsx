import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
      <div className="flex flex-col gap-1">
        <p className="font-medium">App not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This app does not exist or has been deleted.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to apps</Link>
      </Button>
    </div>
  );
}

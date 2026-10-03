import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="page-reading flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
      <div className="flex flex-col gap-1">
        <h1 className="font-medium">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          There is nothing at this address.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to the dashboard</Link>
      </Button>
    </div>
  );
}

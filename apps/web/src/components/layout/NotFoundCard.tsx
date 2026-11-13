import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./PageHeader";

export function NotFoundCard() {
  return (
    <div className="page-reading flex flex-col items-start gap-4">
      <PageHeader
        title="Page not found"
        lede="There is nothing at this address."
      />
      <Button asChild>
        <Link href="/">Back to the dashboard</Link>
      </Button>
    </div>
  );
}

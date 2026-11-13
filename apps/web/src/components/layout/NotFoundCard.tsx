import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LEDE } from "./panel-classes";

export function NotFoundCard() {
  return (
    <div className="page-reading flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-title text-balance">Page not found</h1>
        <p className={LEDE}>There is nothing at this address.</p>
      </div>
      <Button asChild>
        <Link href="/">Back to the dashboard</Link>
      </Button>
    </div>
  );
}

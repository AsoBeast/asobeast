import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppNotFound() {
  return (
    <EmptyState
      title="App not found"
      body="This app does not exist or has been deleted."
      action={
        <Button asChild>
          <Link href="/">Back to apps</Link>
        </Button>
      }
    />
  );
}

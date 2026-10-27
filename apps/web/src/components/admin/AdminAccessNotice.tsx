import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ClosedAdminAccess } from "@/lib/admin-access";

const GUIDE_URL =
  "https://docs.asobeast.com/security/admin-surfaces#when-the-operators-workspace-has-no-plan";

const NOTICES: Record<
  ClosedAdminAccess,
  { title: string; body: string; action: { href: string; label: string } }
> = {
  "needs-plan": {
    title: "Your workspace needs a plan to open the admin area",
    body: "The admin pages, the queue dashboard, the API docs and the metrics endpoint open only while the operator's own workspace has a plan in force. Yours has none, so each of them answers not found. On a self hosted instance with billing on, you can also set plan on the bootstrap workspace in the database.",
    action: { href: "/upgrade", label: "Choose a plan" },
  },
};

export function AdminAccessNotice({ access }: { access: ClosedAdminAccess }) {
  const { title, body, action } = NOTICES[access];

  return (
    <section
      aria-labelledby="admin-access-title"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center"
    >
      <div className="flex flex-col gap-1">
        <h2 id="admin-access-title" className="font-medium">
          {title}
        </h2>
        <p className="max-w-lg text-body text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={GUIDE_URL} target="_blank" rel="noreferrer">
            Read the guide
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </div>
    </section>
  );
}

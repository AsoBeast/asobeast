import { redirect } from "next/navigation";
import { CONFIRM_EMAIL_PATH } from "@asobeast/shared";
import { ConfirmEmailContent } from "@/components/auth/ConfirmEmailContent";
import { entryDestination, loginUrl } from "@/lib/auth-routes";
import { viewer } from "@/lib/viewer";

export default async function ConfirmEmailPage() {
  const user = await viewer();
  if (!user) redirect(loginUrl(CONFIRM_EMAIL_PATH, ""));
  if (user.entryStep !== "confirm-email") {
    redirect(entryDestination(user, null));
  }
  return (
    <ConfirmEmailContent
      email={user.email}
      offered={user.trialAwaitsCheckout === true}
    />
  );
}

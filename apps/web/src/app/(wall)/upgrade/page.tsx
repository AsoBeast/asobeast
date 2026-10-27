import { redirect } from "next/navigation";
import { CONFIRM_EMAIL_PATH } from "@asobeast/shared";
import { UpgradeContent } from "@/components/auth/UpgradeContent";
import { viewer } from "@/lib/viewer";

export default async function UpgradePage() {
  const user = await viewer();
  if (user?.entryStep === "confirm-email") redirect(CONFIRM_EMAIL_PATH);
  return <UpgradeContent />;
}

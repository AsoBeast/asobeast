import { CONFIRM_EMAIL_TO_START_TRIAL } from "@/lib/plan-choice";
import { ResendConfirmationButton } from "./ResendConfirmationButton";

export function ConfirmEmailBanner({ email }: { email: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted px-4 py-2 text-body sm:px-6 print:hidden">
      <span>
        {CONFIRM_EMAIL_TO_START_TRIAL} We sent a link to{" "}
        <strong className="font-medium">{email}</strong>.
      </span>
      <ResendConfirmationButton />
    </div>
  );
}

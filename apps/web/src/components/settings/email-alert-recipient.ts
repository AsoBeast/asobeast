import type { EmailAlertItem } from "@asobeast/shared";

export function awaitsConfirmation(alert: EmailAlertItem): boolean {
  return alert.confirmed === false;
}

export function recipientToast(alert: EmailAlertItem) {
  return { id: `email-alert-${alert.id}` };
}

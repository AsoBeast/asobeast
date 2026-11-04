import type { EssentialAlertsNeed } from "@asobeast/shared";

export const ESSENTIAL_ALERTS_BADGE = "Essential alerts";

export const ESSENTIAL_ALERTS_LINE =
  "Turned on by AsoBeast after your first daily run. Change the rules or stop them here.";

export const ESSENTIAL_ALERTS_EMPTY =
  "No email alerts yet. Add a recipient, or wait for the essential alerts that turn on after your first daily run.";

export const HTTPS_VARIABLE = "WEB_PUBLIC_URL";

const NEED_COPY: Record<EssentialAlertsNeed, string> = {
  smtp: "Once email works, AsoBeast turns on the essential alerts for a new workspace after its first daily run.",
  https: `AsoBeast turns on the essential alerts after your first daily run once ${HTTPS_VARIABLE} is an https address.`,
};

export function essentialNeedCopy(
  need: EssentialAlertsNeed | null | undefined,
): string | null {
  return need ? NEED_COPY[need] : null;
}

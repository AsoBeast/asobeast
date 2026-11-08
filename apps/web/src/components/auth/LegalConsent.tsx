import {
  NEW_TAB_LINK,
  PRIVACY_POLICY,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legal";

const LINK_PROPS = { className: "font-medium underline", ...NEW_TAB_LINK };

export function LegalConsent() {
  return (
    <p className="text-caption text-muted-foreground">
      By creating an account you agree to the{" "}
      <a href={TERMS_OF_SERVICE_URL} {...LINK_PROPS}>
        {TERMS_OF_SERVICE}
      </a>{" "}
      and{" "}
      <a href={PRIVACY_POLICY_URL} {...LINK_PROPS}>
        {PRIVACY_POLICY}
      </a>{" "}
      and confirm you are 18 or over.
    </p>
  );
}

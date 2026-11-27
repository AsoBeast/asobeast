import { useTranslations } from "next-intl";
import {
  NEW_TAB_LINK,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legal";
import { INLINE_LINK } from "./AuthCard";

const LINK_PROPS = { className: INLINE_LINK, ...NEW_TAB_LINK };

export function LegalConsent() {
  const t = useTranslations("auth");
  const tLegal = useTranslations("legal");
  return (
    <p className="text-center text-caption text-pretty text-muted-foreground">
      {t.rich("legalConsent", {
        terms: () => (
          <a href={TERMS_OF_SERVICE_URL} {...LINK_PROPS}>
            {tLegal("termsOfService")}
          </a>
        ),
        privacy: () => (
          <a href={PRIVACY_POLICY_URL} {...LINK_PROPS}>
            {tLegal("privacyPolicy")}
          </a>
        ),
      })}
    </p>
  );
}

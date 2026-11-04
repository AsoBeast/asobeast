import { Link } from 'react-email';
import { alertSettingsLink } from '../../mail/email-links';
import { EmailParagraph } from '../../mail/email-text';
import type { AlertEmailContext } from './alert-footer';

export const ESSENTIAL_ALERTS_INTRO_TEXT =
  'You are getting this because AsoBeast turns on the essential alerts for new apps.';

const CHANGE_THEM = 'Change or stop them in';

export function alertIntroText(context: AlertEmailContext): string | null {
  if (!context.intro) return null;
  const settings = alertSettingsLink(context.origin);
  const where = settings ? `Settings (${settings})` : 'Settings';
  return `${ESSENTIAL_ALERTS_INTRO_TEXT} ${CHANGE_THEM} ${where}.`;
}

export function AlertIntro({ context }: { context: AlertEmailContext }) {
  const settings = alertSettingsLink(context.origin);
  return (
    <EmailParagraph>
      {`${ESSENTIAL_ALERTS_INTRO_TEXT} ${CHANGE_THEM} `}
      {settings ? (
        <Link
          href={settings}
          className="text-ink underline dark:text-night-ink"
        >
          Settings
        </Link>
      ) : (
        'Settings'
      )}
      .
    </EmailParagraph>
  );
}

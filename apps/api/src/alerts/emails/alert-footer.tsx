import { FooterLine, FooterLink } from '../../mail/email-footer';
import { alertSettingsLink, atHost } from '../../mail/email-links';

export interface AlertEmailContext {
  origin: string | null;
  unsubscribe: string | null;
}

function subscriptionReason(origin: string | null): string {
  return `You received this because this address subscribes to AsoBeast email alerts${atHost(origin)}.`;
}

export function alertFooterText(context: AlertEmailContext): string {
  const settings = alertSettingsLink(context.origin);
  return [
    subscriptionReason(context.origin),
    ...(settings ? [`Manage email alerts: ${settings}`] : []),
    ...(settings && context.unsubscribe
      ? [`Unsubscribe: ${context.unsubscribe}`]
      : []),
  ].join('\n');
}

export function AlertFooter({ context }: { context: AlertEmailContext }) {
  const settings = alertSettingsLink(context.origin);
  return (
    <>
      <FooterLine>{subscriptionReason(context.origin)}</FooterLine>
      {settings && (
        <FooterLine>
          <FooterLink href={settings}>Manage email alerts</FooterLink>
          {context.unsubscribe && (
            <>
              {' · '}
              <FooterLink href={context.unsubscribe}>Unsubscribe</FooterLink>
            </>
          )}
        </FooterLine>
      )}
    </>
  );
}

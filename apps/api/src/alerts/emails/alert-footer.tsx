import { FooterLine, FooterLink } from '../../mail/email-footer';
import { alertSettingsLink, atHost } from '../../mail/email-links';

export interface AlertEmailContext {
  origin: string | null;
  unsubscribe: string | null;
}

export function AlertFooter({ context }: { context: AlertEmailContext }) {
  const settings = alertSettingsLink(context.origin);
  return (
    <>
      <FooterLine>
        {`You received this because this address subscribes to AsoBeast email alerts${atHost(context.origin)}.`}
      </FooterLine>
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

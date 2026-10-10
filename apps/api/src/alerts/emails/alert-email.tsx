import { CallToAction } from '../../mail/call-to-action';
import { EmailLayout } from '../../mail/email-layout';
import { EmailHeading } from '../../mail/email-text';
import { FactTable, type Fact } from '../../mail/fact-table';
import { Notice } from '../../mail/notice';
import { AlertFooter, type AlertEmailContext } from './alert-footer';

export interface AlertAction {
  href: string;
  label: string;
}

export interface AlertEmailProps {
  summary: string;
  facts: readonly Fact[];
  action: AlertAction | null;
  occurredAt: string;
  context: AlertEmailContext;
}

export function occurredAtLabel(occurredAt: string): string {
  return `${occurredAt.slice(0, 16).replace('T', ' ')} UTC`;
}

export function AlertEmail({
  summary,
  facts,
  action,
  occurredAt,
  context,
}: AlertEmailProps) {
  return (
    <EmailLayout
      preview={summary}
      origin={context.origin}
      footer={<AlertFooter context={context} />}
    >
      <EmailHeading>{summary}</EmailHeading>
      <FactTable facts={facts} />
      {action && <CallToAction href={action.href} label={action.label} />}
      <Notice>{`Occurred at ${occurredAtLabel(occurredAt)}`}</Notice>
    </EmailLayout>
  );
}

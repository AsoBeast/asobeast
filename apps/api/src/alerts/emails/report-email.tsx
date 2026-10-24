import { CallToAction } from '../../mail/call-to-action';
import { EmailLayout } from '../../mail/email-layout';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import type { ReportApp, ReportLink } from '../report/report';
import { moreApps } from '../report/report-blocks';
import { AlertFooter, type AlertEmailContext } from './alert-footer';
import { ReportCard, ReportNote } from './report-card';
import { StatGrid, type Stat } from './stat-grid';

export interface ReportEmailProps {
  headline: string;
  preview: string;
  stats: Stat[];
  window: string;
  apps: ReportApp[];
  omittedApps: number;
  link: ReportLink | null;
  context: AlertEmailContext;
}

export function ReportEmail({
  headline,
  preview,
  stats,
  window,
  apps,
  omittedApps,
  link,
  context,
}: ReportEmailProps) {
  return (
    <EmailLayout
      preview={preview}
      origin={context.origin}
      footer={<AlertFooter context={context} />}
    >
      <EmailHeading>{headline}</EmailHeading>
      <StatGrid stats={stats} />
      <EmailParagraph>{window}</EmailParagraph>
      {apps.map((app) => (
        <ReportCard key={app.id} app={app} />
      ))}
      {omittedApps > 0 && <ReportNote>{moreApps(omittedApps)}</ReportNote>}
      {link && <CallToAction href={link.href} label={link.label} />}
    </EmailLayout>
  );
}

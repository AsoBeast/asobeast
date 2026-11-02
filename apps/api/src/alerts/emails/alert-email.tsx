import { Section } from 'react-email';
import { CallToAction } from '../../mail/call-to-action';
import { EmailLayout } from '../../mail/email-layout';
import { EmailHeading } from '../../mail/email-text';
import { FactTable } from '../../mail/fact-table';
import { Notice } from '../../mail/notice';
import type { AlertReport } from '../report/report';
import { AlertFooter, type AlertEmailContext } from './alert-footer';
import { CardHeader } from './report-card';
import { ReportRowView } from './report-rows';

export interface AlertEmailProps {
  report: AlertReport;
  context: AlertEmailContext;
}

export function AlertEmail({ report, context }: AlertEmailProps) {
  const [app] = report.apps;
  const iconChanges = (app?.groups ?? [])
    .flatMap((group) => group.rows)
    .filter((row) => row.kind === 'image');
  return (
    <EmailLayout
      preview={report.headline}
      origin={context.origin}
      footer={<AlertFooter context={context} />}
    >
      <EmailHeading>{report.headline}</EmailHeading>
      {app && (
        <Section className="mb-[16px]">
          <CardHeader app={app} />
        </Section>
      )}
      <FactTable facts={report.facts.map((fact) => [fact.label, fact.value])} />
      {iconChanges.map((row, index) => (
        <ReportRowView key={index} row={row} />
      ))}
      {report.link && (
        <CallToAction href={report.link.href} label={report.link.label} />
      )}
      <Notice>{report.dateLabel}</Notice>
    </EmailLayout>
  );
}

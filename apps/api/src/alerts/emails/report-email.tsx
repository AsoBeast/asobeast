import { CallToAction } from '../../mail/call-to-action';
import { EmailLayout } from '../../mail/email-layout';
import { webLink } from '../../mail/email-links';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import { AlertFooter, type AlertEmailContext } from './alert-footer';
import { ReportCard, ReportNote, type ReportCardModel } from './report-card';
import { StatGrid, type Stat } from './stat-grid';

export interface ReportEmailProps {
  headline: string;
  preview: string;
  stats: Stat[];
  window: string;
  cards: ReportCardModel[];
  notes: string[];
  context: AlertEmailContext;
}

export function ReportEmail({
  headline,
  preview,
  stats,
  window,
  cards,
  notes,
  context,
}: ReportEmailProps) {
  const home = webLink(context.origin, '/');
  return (
    <EmailLayout
      preview={preview}
      origin={context.origin}
      footer={<AlertFooter context={context} />}
    >
      <EmailHeading>{headline}</EmailHeading>
      <StatGrid stats={stats} />
      <EmailParagraph>{window}</EmailParagraph>
      {cards.map((card, index) => (
        <ReportCard key={`${card.title}-${index}`} card={card} />
      ))}
      {notes.map((note) => (
        <ReportNote key={note}>{note}</ReportNote>
      ))}
      {home && <CallToAction href={home} label="Open AsoBeast" />}
    </EmailLayout>
  );
}

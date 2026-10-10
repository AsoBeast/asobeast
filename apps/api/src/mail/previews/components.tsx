import { CallToAction } from '../call-to-action';
import { FooterLine, FooterLink } from '../email-footer';
import { EmailLayout } from '../email-layout';
import { EmailHeading, EmailParagraph } from '../email-text';
import { FactTable } from '../fact-table';
import { Notice } from '../notice';
import { PREVIEW_ORIGIN } from './preview-origin';

const LONG_VALUE = `https://example.com/${'a1b2c3d4e5'.repeat(12)}`;

export default function ComponentsPreview() {
  return (
    <EmailLayout
      preview="Every building block of the AsoBeast email layout."
      origin={PREVIEW_ORIGIN}
      footer={
        <FooterLine>
          You received this because you opened the component preview.{' '}
          <FooterLink href={`${PREVIEW_ORIGIN}/settings`}>
            Open settings
          </FooterLink>
        </FooterLine>
      }
    >
      <EmailHeading>Every component in one place</EmailHeading>
      <EmailParagraph>
        Body text sits at sixteen pixels on a twenty six pixel line, in the body
        colour, so long paragraphs stay comfortable to read on a phone.
      </EmailParagraph>
      <EmailParagraph>
        A second paragraph shows the spacing between two blocks of copy.
      </EmailParagraph>
      <CallToAction href={`${PREVIEW_ORIGIN}/`} label="Primary action" />
      <FactTable
        facts={[
          ['App', 'Fitness Coach · App Store · US'],
          ['Keyword', 'habit tracker'],
          ['Long value', LONG_VALUE],
        ]}
      />
      <Notice>
        The link expires in an hour. Ignore this email if you did not ask for
        it.
      </Notice>
    </EmailLayout>
  );
}

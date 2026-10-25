import {
  alpha,
  batch,
  competitorBatch,
  digestWithGroups,
  dropped,
  negative,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from '../report/build-alert';
import { buildReport } from '../report/build-report';
import { escapeHtml } from './chat-escape';
import { telegramBody, visibleLength } from './telegram';

const ORIGIN = 'https://aso.example.com';

describe('telegramBody for a batch', () => {
  it('sends html to the chat with one button and no link preview', () => {
    const message = telegramBody(buildReport(batch, ORIGIN), '-100');

    expect(message).toMatchObject({
      chat_id: '-100',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [[{ text: 'Open AsoBeast', url: `${ORIGIN}/` }]],
      },
    });
    expect(message.text.split('\n').slice(0, 8)).toEqual([
      '<b>📊 Daily app update: 3 changes across 2 apps</b>',
      '22 Jul 2026 (UTC)',
      '',
      `<b><a href="${ORIGIN}/apps/a">Alpha</a></b>`,
      'App Store · 🇺🇸 US',
      '<i>Rank drops</i>',
      'game  #3 → #12',
      '<i>Listing changes</i>',
    ]);
  });

  it('indents competitors under the primary app', () => {
    const { text } = telegramBody(buildReport(competitorBatch, null), '1');

    expect(text).toContain('<b>Alpha</b>\nYour app · App Store · 🇺🇸 US');
    expect(text).toContain(
      '  <b>Charlie</b>\n  Competitor · App Store · 🇺🇸 US',
    );
    expect(text).toContain('  Subtitle: "a" → "b"'.replace(/"/g, '&quot;'));
  });

  it('links the rest of a cut group and stays within 4096 characters', () => {
    for (const scope of ['owned_apps', 'competitors', null] as const) {
      const { text } = telegramBody(
        buildReport(worstCaseBatch(scope), ORIGIN),
        '1',
      );

      expect(visibleLength(text)).toBeLessThanOrEqual(4096);
      expect(text).toMatch(/\+\d+ more apps$/);
    }
    expect(
      telegramBody(buildReport(worstCaseBatch('owned_apps'), ORIGIN), '1').text,
    ).toContain(`<a href="${ORIGIN}/apps/app_0/keywords">See all 25</a>`);
  });

  it('escapes everything a store user wrote', () => {
    const hostile = {
      ...alpha,
      app: { ...alpha.app, name: '<b>Fake</b> & Co' },
      rankDrops: [
        {
          ...alpha.rankDrops[0],
          keyword: {
            ...alpha.rankDrops[0].keyword,
            text: '<script>x</script>',
          },
        },
      ],
    };
    const { text } = telegramBody(
      buildReport({ ...batch, apps: [hostile] }, null),
      '1',
    );

    expect(text).toContain('<b>&lt;b&gt;Fake&lt;/b&gt; &amp; Co</b>');
    expect(text).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(text).not.toContain('<script>');
  });

  it('sends no button without an origin', () => {
    expect(
      telegramBody(buildReport(batch, null), '1').reply_markup,
    ).toBeUndefined();
  });
});

describe('telegramBody for a single alert', () => {
  it('heads the sentence and lists the facts in bold labels', () => {
    const message = telegramBody(buildAlert(dropped, ORIGIN), '-100');

    expect(message.text).toBe(
      [
        '<b>📉 My App dropped from #4 to #12 for &quot;fitness app&quot; in 🇺🇸 US</b>',
        '11 Jul 2026, 00:00 UTC',
        '',
        '<b>Keyword</b>: fitness app (US)',
        '<b>From</b>: #4',
        '<b>To</b>: #12',
        '<b>Alert threshold</b>: 5',
      ].join('\n'),
    );
    expect(message.reply_markup?.inline_keyboard[0][0].text).toBe('Open app');
  });

  it('keeps a very long review inside the limit', () => {
    const { text } = telegramBody(
      buildAlert(
        {
          ...negative,
          review: { ...negative.review, text: 'x'.repeat(10_000) },
        },
        null,
      ),
      '1',
    );

    expect(visibleLength(text)).toBeLessThanOrEqual(4096);
    expect(text).toContain('<b>Review</b>: ');
  });

  it('keeps whole facts and their formatting when a digest overflows', () => {
    const groups = Array.from({ length: 200 }, (_, index) => ({
      ...digestWithGroups.groups[0],
      id: `grp_${index}`,
      name: `Group ${index}`,
    }));
    const { text } = telegramBody(
      buildAlert({ ...digestWithGroups, groups }, ORIGIN),
      '1',
    );

    expect(visibleLength(text)).toBeLessThanOrEqual(4096);
    expect(text.startsWith('<b>')).toBe(true);
    expect(text).toMatch(/\n\+\d+ more$/);
  });

  it('keeps a very long app name inside the limit', () => {
    const { text } = telegramBody(
      buildAlert(
        { ...dropped, app: { ...dropped.app, name: 'n'.repeat(10_000) } },
        null,
      ),
      '1',
    );

    expect(visibleLength(text)).toBeLessThanOrEqual(4096);
    expect(text).toContain('<b>Keyword</b>: fitness app (US)');
  });
});

describe('escapeHtml and visibleLength', () => {
  it('escapes the html characters telegram reads', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('counts the characters a reader sees', () => {
    expect(visibleLength('<b>a &amp; b</b>')).toBe(5);
  });
});

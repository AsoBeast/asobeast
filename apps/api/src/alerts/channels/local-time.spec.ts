import { discordTime, slackDate, unixSeconds, utcFallback } from './local-time';

const ISO = '2026-10-24T03:10:00.000Z';

describe('local time tokens', () => {
  it('reads an instant in unix seconds', () => {
    expect(unixSeconds(ISO)).toBe(1_792_811_400);
    expect(unixSeconds('soon')).toBeNull();
  });

  it('writes a discord token in the requested style', () => {
    expect(discordTime(ISO, 'x')).toBe('<t:1792811400:f>');
    expect(discordTime(ISO, 'x', 'D')).toBe('<t:1792811400:D>');
  });

  it('writes a slack date token with the utc fallback', () => {
    expect(slackDate(ISO, utcFallback('24 Oct 2026'))).toBe(
      '<!date^1792811400^{date_short_pretty} at {time}|24 Oct 2026 (UTC)>',
    );
  });

  it('prints the fallback for an instant it cannot read', () => {
    expect(discordTime('soon', 'fallback')).toBe('fallback');
    expect(slackDate('soon', 'fallback')).toBe('fallback');
  });
});

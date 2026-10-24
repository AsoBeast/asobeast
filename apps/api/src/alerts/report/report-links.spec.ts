import { reportLinks } from './report-links';

const ORIGIN = 'https://aso.example.com';

describe('reportLinks', () => {
  it('builds no link without an origin', () => {
    const links = reportLinks(null);

    expect(links.home).toBeNull();
    expect(links.app('a')).toBeNull();
    expect(links.group('a', 'rankDrops', 3)).toBeNull();
    expect(links.competitors('a', 14)).toBeNull();
  });

  it('opens the home page and the app page', () => {
    const links = reportLinks(ORIGIN);

    expect(links.home).toEqual({ href: `${ORIGIN}/`, label: 'Open AsoBeast' });
    expect(links.app('a')).toEqual({
      href: `${ORIGIN}/apps/a`,
      label: 'Open app',
    });
  });

  it.each([
    ['rankDrops', '/apps/a/keywords'],
    ['overtakes', '/apps/a/keywords'],
    ['serpEntrants', '/apps/a/rankings'],
    ['changes', '/apps/a/changes'],
    ['actions', '/apps/a/actions'],
  ] as const)('sends the %s group to %s', (kind, path) => {
    expect(reportLinks(ORIGIN).group('a', kind, 32)).toEqual({
      href: `${ORIGIN}${path}`,
      label: 'See all 32 in AsoBeast',
    });
  });

  it('filters the reviews page to the one score the group holds', () => {
    expect(
      reportLinks(ORIGIN).group('a', 'negativeReviews', 4, [1, 1])?.href,
    ).toBe(`${ORIGIN}/apps/a/reviews?score=1`);
  });

  it('lists the lowest reviews first when the group holds several scores', () => {
    expect(
      reportLinks(ORIGIN).group('a', 'negativeReviews', 4, [2, 1, 2])?.href,
    ).toBe(`${ORIGIN}/apps/a/reviews?sort=lowest`);
    expect(reportLinks(ORIGIN).group('a', 'negativeReviews', 4)?.href).toBe(
      `${ORIGIN}/apps/a/reviews?sort=lowest`,
    );
  });

  it('names the total of the competitors it links to', () => {
    expect(reportLinks(ORIGIN).competitors('a', 14)).toEqual({
      href: `${ORIGIN}/apps/a/competitors`,
      label: 'See all 14 competitors',
    });
  });

  it('opens an action only when the payload links to it', () => {
    const links = reportLinks(null);

    expect(links.action('https://aso.example.com/actions?action=x')).toEqual({
      href: 'https://aso.example.com/actions?action=x',
      label: 'Open the action',
    });
    expect(links.action(null)).toBeNull();
  });
});

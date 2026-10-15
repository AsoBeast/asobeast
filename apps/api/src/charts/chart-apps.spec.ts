import { chartAppLinks, WorkspaceAppRow } from './chart-apps';

const row = (
  id: string,
  storeAppId: string,
  primary: { id: string; name: string } | null = null,
): WorkspaceAppRow => ({
  id,
  storeAppId,
  name: `${id} name`,
  isCompetitor: primary !== null,
  primaryAppId: primary?.id ?? null,
  primaryApp: primary ? { name: primary.name } : null,
});

describe('chartAppLinks', () => {
  it('lists own apps first, then competitors with the app they compete with', () => {
    const links = chartAppLinks(
      [row('rival', '1', { id: 'mine', name: 'Mine' }), row('mine', '2')],
      ['1', '2'],
    );

    expect(links).toEqual([
      {
        storeAppId: '2',
        appId: 'mine',
        primaryAppId: null,
        name: 'mine name',
        role: 'own',
      },
      {
        storeAppId: '1',
        appId: 'rival',
        primaryAppId: 'mine',
        name: 'Mine',
        role: 'competitor',
      },
    ]);
  });

  it('names each store id once, preferring the own app', () => {
    const links = chartAppLinks(
      [
        row('rival-a', '1', { id: 'a', name: 'A' }),
        row('rival-b', '1', { id: 'b', name: 'B' }),
        row('own', '1'),
      ],
      ['1'],
    );

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ appId: 'own', role: 'own' });
  });

  it('leaves out an app the chart does not name', () => {
    expect(chartAppLinks([row('mine', '9')], ['1'])).toEqual([]);
  });
});

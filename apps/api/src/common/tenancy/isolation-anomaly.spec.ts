import { foreignWorkspaces } from './isolation-anomaly';

describe('foreignWorkspaces', () => {
  it('finds nothing when every row belongs to the scope', () => {
    expect(
      foreignWorkspaces(
        [{ workspaceId: 'ws_a' }, { workspaceId: 'ws_a' }],
        'ws_a',
      ),
    ).toEqual([]);
  });

  it('names each foreign owner once', () => {
    const rows = [
      { workspaceId: 'ws_a' },
      { workspaceId: 'ws_b' },
      { workspaceId: 'ws_b' },
      { workspaceId: 'ws_c' },
    ];

    expect(foreignWorkspaces(rows, 'ws_a')).toEqual(['ws_b', 'ws_c']);
  });

  it('inspects a single row result', () => {
    expect(foreignWorkspaces({ workspaceId: 'ws_b' }, 'ws_a')).toEqual([
      'ws_b',
    ]);
  });

  it('ignores rows that carry no workspace', () => {
    expect(foreignWorkspaces([{ id: 'kw1' }, null, 3], 'ws_a')).toEqual([]);
  });

  it('ignores a count or aggregate result', () => {
    expect(foreignWorkspaces(7, 'ws_a')).toEqual([]);
  });

  it('finds an owner reached through an included relation', () => {
    const rows = [{ id: 'rev1', app: { id: 'app1', workspaceId: 'ws_b' } }];

    expect(foreignWorkspaces(rows, 'ws_a')).toEqual(['ws_b']);
  });

  it('finds an owner inside an included relation list', () => {
    const rows = [
      { id: 'app1', workspaceId: 'ws_a', snapshots: [{ workspaceId: 'ws_c' }] },
    ];

    expect(foreignWorkspaces(rows, 'ws_a')).toEqual(['ws_c']);
  });

  it('stays quiet when an included relation belongs to the scope', () => {
    const rows = [{ id: 'rev1', app: { workspaceId: 'ws_a' } }];

    expect(foreignWorkspaces(rows, 'ws_a')).toEqual([]);
  });

  it('reads a raw query row the same way as a model row', () => {
    expect(
      foreignWorkspaces([{ workspaceId: 'ws_b', count: 3 }], 'ws_a'),
    ).toEqual(['ws_b']);
  });
});

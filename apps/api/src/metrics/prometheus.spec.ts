import { renderMetrics } from './prometheus';

describe('renderMetrics', () => {
  it('renders help, type and samples for a family', () => {
    const text = renderMetrics([
      {
        name: 'asobeast_workspace_apps',
        help: 'Apps tracked by a workspace',
        samples: [{ labels: { workspace: 'ws_a' }, value: 3 }],
      },
    ]);

    expect(text).toBe(
      [
        '# HELP asobeast_workspace_apps Apps tracked by a workspace',
        '# TYPE asobeast_workspace_apps gauge',
        'asobeast_workspace_apps{workspace="ws_a"} 3',
        '',
      ].join('\n'),
    );
  });

  it('renders an unlabelled sample without a selector', () => {
    expect(
      renderMetrics([
        {
          name: 'asobeast_billing_trials_active',
          help: 'Trials',
          samples: [{ value: 2 }],
        },
      ]),
    ).toContain('asobeast_billing_trials_active 2');
  });

  it('drops a family with no samples', () => {
    expect(renderMetrics([{ name: 'empty', help: 'none', samples: [] }])).toBe(
      '\n',
    );
  });

  it('escapes quotes and backslashes in a label value', () => {
    expect(
      renderMetrics([
        {
          name: 'metric',
          help: 'help',
          samples: [{ labels: { name: 'a"b\\c' }, value: 1 }],
        },
      ]),
    ).toContain('metric{name="a\\"b\\\\c"} 1');
  });

  it('renders a non finite value as zero', () => {
    expect(
      renderMetrics([
        { name: 'metric', help: 'help', samples: [{ value: Number.NaN }] },
      ]),
    ).toContain('metric 0');
  });
});

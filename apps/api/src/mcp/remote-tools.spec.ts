import { toolText, type ReadTool } from '@asobeast/mcp-tools';
import { toolResult } from './remote-tools';

const tool = { name: 'portfolio' } as ReadTool;

describe('toolResult', () => {
  it('answers with the same compact text the stdio server writes', () => {
    const body = {
      apps: [{ id: 'app-1', visibility: 41 }],
      totals: { apps: 1 },
    };

    const result = toolResult(tool, { status: 200, body });

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: toolText(body) }]);
  });

  it('answers null for an empty body', () => {
    const result = toolResult(tool, { status: 204, body: undefined });

    expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
  });
});

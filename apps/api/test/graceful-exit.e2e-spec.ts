import { fork } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';

const EXIT_DEADLINE_MS = 5_000;

describe('A signalled stop ends the process (e2e)', () => {
  it('exits after the shutdown hooks although the signal itself is ignored and a handle is open', async () => {
    const child = fork(join(__dirname, 'helpers', 'signalled-app.ts'), [], {
      execArgv: ['-r', 'ts-node/register/transpile-only'],
      stdio: 'ignore',
    });
    try {
      await once(child, 'message');
      const exited = once(child, 'exit').then(() => true);
      child.kill('SIGTERM');

      const ended = await Promise.race([
        exited,
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), EXIT_DEADLINE_MS).unref(),
        ),
      ]);

      expect(ended).toBe(true);
    } finally {
      child.kill('SIGKILL');
    }
  });
});

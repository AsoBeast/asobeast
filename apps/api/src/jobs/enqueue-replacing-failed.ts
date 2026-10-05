import { isDeepStrictEqual } from 'node:util';
import { JobsOptions, Queue } from 'bullmq';

const asStored = (data: object): unknown => JSON.parse(JSON.stringify(data));

export async function enqueueReplacingFailed(
  queue: Queue,
  name: string,
  data: object,
  opts: JobsOptions & { jobId: string },
): Promise<boolean> {
  const existing = await queue.getJob(opts.jobId);
  if (existing) {
    if (!(await existing.isFailed())) return false;
    if ((await queue.remove(opts.jobId)) !== 1) return false;
  }
  await queue.add(name, data, opts);
  const stored = await queue.getJob(opts.jobId);
  return !stored || isDeepStrictEqual(stored.data, asStored(data));
}

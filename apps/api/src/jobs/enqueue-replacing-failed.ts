import { randomUUID } from 'node:crypto';
import { JobsOptions, Queue } from 'bullmq';

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
  const enqueueClaim = randomUUID();
  await queue.add(name, { ...data, enqueueClaim }, opts);
  const stored = await queue.getJob(opts.jobId);
  const storedClaim = (stored?.data as { enqueueClaim?: string } | undefined)
    ?.enqueueClaim;
  return storedClaim === enqueueClaim;
}

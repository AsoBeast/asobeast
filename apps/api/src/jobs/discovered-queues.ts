import { WorkerHost } from '@nestjs/bullmq';
import { DiscoveryService } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';

const instancesOf = (discovery: DiscoveryService): unknown[] =>
  discovery.getProviders().map((wrapper): unknown => wrapper.instance);

function createdWorker(host: WorkerHost<Worker>): Worker[] {
  try {
    return [host.worker];
  } catch {
    return [];
  }
}

export function discoveredQueues(discovery: DiscoveryService): Queue[] {
  return instancesOf(discovery).filter(
    (instance): instance is Queue => instance instanceof Queue,
  );
}

export function discoveredWorkers(discovery: DiscoveryService): Worker[] {
  return instancesOf(discovery)
    .filter(
      (instance): instance is WorkerHost<Worker> =>
        instance instanceof WorkerHost,
    )
    .flatMap(createdWorker);
}

import { SetMetadata } from '@nestjs/common';

export const QUEUES_WORK_KEY = 'queuesWork';

export const QueuesWork = () => SetMetadata(QUEUES_WORK_KEY, true);

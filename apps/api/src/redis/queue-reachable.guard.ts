import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FailFastRedis } from './fail-fast-redis';
import { QUEUES_WORK_KEY } from './queues-work.decorator';

@Injectable()
export class QueueReachableGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: FailFastRedis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const queuesWork = this.reflector.getAllAndOverride<boolean>(
      QUEUES_WORK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (queuesWork === true) await this.redis.run((client) => client.ping());
    return true;
  }
}

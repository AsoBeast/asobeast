import { Injectable, type OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PoolShutdown implements OnModuleDestroy {
  private stopping = false;

  get stopped(): boolean {
    return this.stopping;
  }

  onModuleDestroy(): void {
    this.stopping = true;
  }
}

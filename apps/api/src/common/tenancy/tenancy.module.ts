import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenancyCoreModule } from './tenancy-core.module';
import { WorkspaceFanOut } from './workspace-fanout';
import { WorkspaceContextMiddleware } from './workspace-context.middleware';

@Global()
@Module({
  imports: [TenancyCoreModule],
  providers: [WorkspaceFanOut],
  exports: [TenancyCoreModule, WorkspaceFanOut],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WorkspaceContextMiddleware).forRoutes('{*path}');
  }
}

import { Global, Module } from '@nestjs/common';
import { CrossTenantAccess } from './cross-tenant-access';
import { IsolationMonitor } from './isolation-monitor.service';
import { WorkspaceContext } from './workspace-context';

@Global()
@Module({
  providers: [WorkspaceContext, CrossTenantAccess, IsolationMonitor],
  exports: [WorkspaceContext, CrossTenantAccess, IsolationMonitor],
})
export class TenancyCoreModule {}

import { Global, Module } from '@nestjs/common';
import { TenancyCoreModule } from '../common/tenancy/tenancy-core.module';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [TenancyCoreModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

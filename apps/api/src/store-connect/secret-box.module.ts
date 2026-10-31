import { Global, Module } from '@nestjs/common';
import { SECRET_BOX, secretBoxProvider } from './secret-box.provider';

@Global()
@Module({
  providers: [secretBoxProvider],
  exports: [SECRET_BOX],
})
export class SecretBoxModule {}

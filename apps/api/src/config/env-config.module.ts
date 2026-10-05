import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env';

export const envConfigModule = () =>
  ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: process.env.NODE_ENV === 'test',
    validate: validateEnv,
  });

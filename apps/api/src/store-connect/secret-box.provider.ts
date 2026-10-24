import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeSecretKey, SecretBox } from '../common/crypto/secret-box';
import type { Env } from '../config/env';

export const SECRET_BOX = Symbol('SECRET_BOX');

export const secretBoxProvider: Provider = {
  provide: SECRET_BOX,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): SecretBox | null => {
    const current = config.get('STORE_CONNECT_ENCRYPTION_KEY', { infer: true });
    if (!current) return null;
    const previous = config.get('STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS', {
      infer: true,
    });
    return new SecretBox(
      decodeSecretKey(current),
      previous ? decodeSecretKey(previous) : null,
    );
  },
};

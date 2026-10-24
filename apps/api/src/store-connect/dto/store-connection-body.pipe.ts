import {
  BadRequestException,
  Injectable,
  type PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import type { StoreConnectionRequest } from '@asobeast/shared';
import { AppStoreConnectionDto } from './app-store-connection.dto';
import { PlayConnectionDto } from './play-connection.dto';

const BODIES = {
  APP_STORE: AppStoreConnectionDto,
  GOOGLE_PLAY: PlayConnectionDto,
} as const;

const STORE_REQUIRED = `store must be one of the following values: ${Object.keys(BODIES).join(', ')}`;

const storeOf = (body: unknown): keyof typeof BODIES | null => {
  const store = (body as { store?: unknown } | null)?.store;
  return typeof store === 'string' && Object.hasOwn(BODIES, store)
    ? (store as keyof typeof BODIES)
    : null;
};

@Injectable()
export class StoreConnectionBodyPipe implements PipeTransform {
  private readonly validation = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  transform(body: unknown): Promise<StoreConnectionRequest> {
    const store = storeOf(body);
    if (!store) throw new BadRequestException([STORE_REQUIRED]);
    return this.validation.transform(body, {
      type: 'body',
      metatype: BODIES[store],
    }) as Promise<StoreConnectionRequest>;
  }
}

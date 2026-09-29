import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Store } from '@asobeast/shared';
import { ActionScopeQueryDto } from './dto/action-scope-query.dto';

export interface ActionSummaryScope {
  appId?: string;
  store?: Store;
  country?: string;
}

export function parseSummaryScope(
  query: Record<string, unknown>,
): ActionSummaryScope {
  const scope = plainToInstance(ActionScopeQueryDto, {
    appId: query.appId,
    store: query.store,
    country: query.country,
  });
  const messages = validateSync(scope).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
  if (messages.length > 0) {
    throw new BadRequestException(messages);
  }
  return { appId: scope.appId, store: scope.store, country: scope.country };
}

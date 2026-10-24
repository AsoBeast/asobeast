import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type {
  StoreConnectionItem,
  StoreConnectionRequest,
  StoreConnectionState,
  StoreConnectionSyncResult,
} from '@asobeast/shared';
import type { AccountUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionOnly } from '../auth/decorators/session-only.decorator';
import { OwnerGuard } from '../auth/guards/owner.guard';
import { AppStoreConnectionDto } from './dto/app-store-connection.dto';
import { PlayConnectionDto } from './dto/play-connection.dto';
import { StoreConnectionBodyPipe } from './dto/store-connection-body.pipe';
import { StoreParamDto } from './dto/store-param.dto';
import { StoreConnectionService } from './store-connection.service';

@ApiTags('store-connect')
@ApiExtraModels(AppStoreConnectionDto, PlayConnectionDto)
@Controller('store-connections')
export class StoreConnectionsController {
  constructor(private readonly connections: StoreConnectionService) {}

  @Get()
  @ApiOperation({
    summary: 'The store consoles this workspace has connected',
    description:
      'Every connected store console key with its status, the access its report requests were granted, and each primary app of that store with its report state and the first and last day of stored funnel rows. Never returns key material. available is false when the instance has no STORE_CONNECT_ENCRYPTION_KEY.',
  })
  state(): Promise<StoreConnectionState> {
    return this.connections.state();
  }

  @Put(':store')
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Connect a store console key',
    description:
      'Verifies the key with the store, seals it at rest bound to this workspace and replaces any key connected before, then queues a report sync. App Store Connect takes an issuer ID, a key ID and a .p8 private key; Google Play takes a service account JSON key and the bucket id of its Play Console reports. The store in the body must match the path. Owner only, through a signed in session. Answers 422 when the store refuses the key and 409 when the instance has store connections off.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AppStoreConnectionDto) },
        { $ref: getSchemaPath(PlayConnectionDto) },
      ],
      discriminator: { propertyName: 'store' },
    },
  })
  connect(
    @Param() { store }: StoreParamDto,
    @Body(StoreConnectionBodyPipe) dto: StoreConnectionRequest,
    @CurrentUser() user: AccountUser,
  ): Promise<StoreConnectionItem> {
    return this.connections.connect(store, dto, user.id);
  }

  @Post(':store/verify')
  @HttpCode(200)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Verify the connected store console key again',
    description:
      'Asks the store whether the stored key still works. A refused key marks the connection rejected; an accepted one clears that and queues a report sync. Answers 409 when the stored key can no longer be decrypted.',
  })
  verify(@Param() { store }: StoreParamDto): Promise<StoreConnectionItem> {
    return this.connections.verify(store);
  }

  @Post(':store/sync')
  @HttpCode(202)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Queue a report sync for the connected store console',
    description:
      'Queues the download of the reports the store has published since the last sync. A sync already waiting is not queued twice. Answers 409 while the store refuses the key.',
  })
  sync(@Param() { store }: StoreParamDto): Promise<StoreConnectionSyncResult> {
    return this.connections.sync(store);
  }

  @Delete(':store')
  @HttpCode(204)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Disconnect a store console',
    description:
      'Deletes the sealed key and its report requests, even while the instance has store connections off. The funnel rows already stored stay.',
  })
  disconnect(@Param() { store }: StoreParamDto): Promise<void> {
    return this.connections.disconnect(store);
  }
}

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PlaySignInStart, StoreConnectionItem } from '@asobeast/shared';
import type { AccountUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionOnly } from '../auth/decorators/session-only.decorator';
import { OwnerGuard } from '../auth/guards/owner.guard';
import { PlaySignInCompletionDto, PlaySignInDto } from './dto/play-sign-in.dto';
import { PlaySignIn } from './play/play-sign-in.service';

@ApiTags('store-connect')
@Controller('store-connections/GOOGLE_PLAY/sign-in')
export class PlaySignInController {
  constructor(private readonly signIn: PlaySignIn) {}

  @Post()
  @HttpCode(200)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Start connecting Google Play with a Google account',
    description:
      'Answers the Google consent address to send the owner to, asking for read only Cloud Storage access, with a state sealed to this owner and workspace that expires in ten minutes. Google returns to the web page /settings/google-play. Owner only, through a signed in session. Answers 409 when the instance has store connections off or no Google OAuth client.',
  })
  start(
    @Body() { bucket }: PlaySignInDto,
    @CurrentUser() user: AccountUser,
  ): PlaySignInStart {
    return this.signIn.start(bucket, user.id);
  }

  @Post('complete')
  @HttpCode(200)
  @SessionOnly()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Finish connecting Google Play with a Google account',
    description:
      'Redeems the code Google returned, lists the bucket with the account before anything is stored, seals the refresh token bound to this workspace, replaces any Google Play connection and queues a report sync. Answers 400 for a state of another owner, an expired state or a code Google refuses, 422 when the account was not granted Cloud Storage access or cannot read the bucket, and 409 when sign in is off or Google refuses the OAuth client of the instance.',
  })
  complete(
    @Body() completion: PlaySignInCompletionDto,
    @CurrentUser() user: AccountUser,
  ): Promise<StoreConnectionItem> {
    return this.signIn.complete(completion, user.id);
  }
}

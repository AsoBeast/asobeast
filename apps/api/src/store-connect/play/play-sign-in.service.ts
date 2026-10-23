import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  PlaySignInCompletion,
  PlaySignInStart,
  StoreConnectionItem,
} from '@asobeast/shared';
import type { SecretBox } from '../../common/crypto/secret-box';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import { SECRET_BOX } from '../secret-box.provider';
import {
  STORE_CONNECT_OFF,
  StoreConnectionService,
} from '../store-connection.service';
import {
  GCS_TRANSPORT,
  type GcsResponse,
  type GcsTransport,
  GcsUnreachableError,
} from './gcs-transport';
import {
  authorizationCodeGrant,
  authorizationUrl,
  CLIENT_REFUSED,
  GOOGLE_OAUTH_CLIENT,
  type GoogleOAuthClient,
  isClientRefusal,
  MissingStorageScopeError,
  oauthErrorOf,
  pkcePair,
  SIGN_IN_OFF,
  type SignedInAccount,
  signedInAccount,
  UnreadableSignInError,
} from './google-sign-in';
import { GOOGLE_TOKEN_AUDIENCE } from './service-account';
import {
  openSignInState,
  sealSignInState,
  SIGN_IN_STATE_TTL_MS,
  type SignInOwner,
} from './sign-in-state';

export const SIGN_IN_EXPIRED =
  'This Google sign in expired or was started by another account. Sign in with Google again.';
export const SIGN_IN_REFUSED =
  'Google did not accept this sign in. It expired or was already used. Sign in with Google again.';
export const STORAGE_SCOPE_MISSING =
  'Google did not grant access to Cloud Storage. Sign in with Google again and keep "View your data in Google Cloud Storage" ticked on the consent screen.';
const OPERATION = 'a google play sign in';

@Injectable()
export class PlaySignIn {
  constructor(
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
    @Inject(GOOGLE_OAUTH_CLIENT)
    private readonly client: GoogleOAuthClient | null,
    @Inject(GCS_TRANSPORT) private readonly transport: GcsTransport,
    private readonly workspace: WorkspaceContext,
    private readonly connections: StoreConnectionService,
  ) {}

  start(bucket: string, userId: string): PlaySignInStart {
    const { box, client } = this.ready();
    const { verifier, challenge } = pkcePair();
    const state = sealSignInState(box, this.ownerOf(userId), {
      bucket,
      verifier,
      expiresAt: Date.now() + SIGN_IN_STATE_TTL_MS,
    });
    return { url: authorizationUrl(client, state, challenge) };
  }

  async complete(
    { code, state }: PlaySignInCompletion,
    userId: string,
  ): Promise<StoreConnectionItem> {
    const { box, client } = this.ready();
    const opened = openSignInState(box, this.ownerOf(userId), state);
    if (!opened) throw new BadRequestException(SIGN_IN_EXPIRED);
    const account = await this.redeem(client, code, opened.verifier);
    return this.connections.connectGoogleAccount(
      {
        email: account.email,
        refreshToken: account.refreshToken,
        bucket: opened.bucket,
      },
      account.subject,
      userId,
    );
  }

  private ownerOf(userId: string): SignInOwner {
    return { workspaceId: this.workspace.require(OPERATION), userId };
  }

  private ready(): { box: SecretBox; client: GoogleOAuthClient } {
    if (!this.box) throw new ConflictException(STORE_CONNECT_OFF);
    if (!this.client) throw new ConflictException(SIGN_IN_OFF);
    return { box: this.box, client: this.client };
  }

  private async redeem(
    client: GoogleOAuthClient,
    code: string,
    verifier: string,
  ): Promise<SignedInAccount> {
    const response = await this.exchange(
      authorizationCodeGrant(client, code, verifier),
    );
    if (isClientRefusal(oauthErrorOf(response.body))) {
      throw new ConflictException(CLIENT_REFUSED);
    }
    if (response.status >= 400 && response.status < 500) {
      throw new BadRequestException(SIGN_IN_REFUSED);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new BadGatewayException(`Google answered ${response.status}`);
    }
    try {
      return signedInAccount(response.body);
    } catch (error) {
      if (error instanceof MissingStorageScopeError) {
        throw new UnprocessableEntityException(STORAGE_SCOPE_MISSING);
      }
      if (error instanceof UnreadableSignInError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }

  private async exchange(form: Record<string, string>): Promise<GcsResponse> {
    try {
      return await this.transport({
        method: 'POST',
        url: GOOGLE_TOKEN_AUDIENCE,
        form,
      });
    } catch (error) {
      if (error instanceof GcsUnreachableError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }
}

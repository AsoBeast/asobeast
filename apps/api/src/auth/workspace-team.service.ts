import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { type User, type WorkspaceInvite } from '@prisma/client';
import {
  INVITE_PATH,
  type WorkspaceInviteCreated,
  type WorkspaceInviteItem,
  type WorkspaceMember,
  type WorkspaceTeam,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { MailerService } from '../alerts/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { invitationEmail } from './emails/invitation-email';
import { sha256 } from './password-hash';
import { PublicWebUrl } from './public-web-url';
import type { AccountUser } from './auth.types';
import { refuseSessionSwap } from './session-swap';
import { MEMBER_ROLE, OWNER_ROLE, workspaceRoleOf } from './workspace-roles';

const INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACCEPT_JUSTIFICATION =
  'an invited account joins a workspace it cannot yet be scoped to';

@Injectable()
export class WorkspaceTeamService {
  private readonly logger = new Logger(WorkspaceTeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly mailer: MailerService,
    private readonly web: PublicWebUrl,
  ) {}

  async team(): Promise<WorkspaceTeam> {
    const [members, invites] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.workspaceInvite.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      members: members.map(toMember),
      invites: invites.map(toInvite),
    };
  }

  async invite(
    owner: AccountUser,
    email: string,
  ): Promise<WorkspaceInviteCreated> {
    const normalized = email.trim().toLowerCase();
    if (await this.emailTaken(normalized)) {
      throw new ConflictException('That email already has an account');
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * DAY_MS);
    const invite = await this.prisma.workspaceInvite.upsert({
      where: {
        workspaceId_email: {
          workspaceId: owner.workspaceId,
          email: normalized,
        },
      },
      update: { tokenHash: sha256(token), expiresAt },
      create: {
        workspaceId: owner.workspaceId,
        email: normalized,
        role: MEMBER_ROLE,
        tokenHash: sha256(token),
        expiresAt,
      },
    });

    return {
      ...toInvite(invite),
      acceptPath: `${INVITE_PATH}?token=${token}`,
      delivered: await this.deliver(normalized, token, owner),
    };
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.workspaceInvite.deleteMany({ where: { id } });
  }

  async remove(owner: AccountUser, id: string): Promise<void> {
    if (id === owner.id) {
      throw new ForbiddenException('The owner cannot remove their own account');
    }
    const member = await this.prisma.user.findFirst({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === OWNER_ROLE) {
      throw new ForbiddenException('A workspace keeps its owner');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  async accept(
    token: string,
    password: string,
    name: string | null,
    signedIn: User | null,
  ): Promise<AccountUser> {
    refuseSessionSwap(signedIn, null);
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      ACCEPT_JUSTIFICATION,
      () => this.claim(token, password, name),
    );
  }

  private async claim(
    token: string,
    password: string,
    name: string | null,
  ): Promise<AccountUser> {
    const passwordHash = await argon2.hash(password);
    return this.prisma.withTransaction(async (tx) => {
      const invite = await tx.workspaceInvite.findUnique({
        where: { tokenHash: sha256(token) },
      });
      if (!invite || invite.expiresAt <= new Date()) {
        throw new NotFoundException('That invitation is no longer valid');
      }
      if (await tx.user.findUnique({ where: { email: invite.email } })) {
        throw new ConflictException('That email already has an account');
      }
      const user = await tx.user.create({
        data: {
          workspaceId: invite.workspaceId,
          email: invite.email,
          passwordHash,
          name,
          role: workspaceRoleOf(invite.role),
        },
        include: { workspace: true },
      });
      await tx.workspaceInvite.delete({ where: { id: invite.id } });
      return user;
    });
  }

  private emailTaken(email: string): Promise<boolean> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'an invited email must be unique across every account',
      async () => (await this.prisma.user.count({ where: { email } })) > 0,
    );
  }

  private async deliver(
    email: string,
    token: string,
    owner: AccountUser,
  ): Promise<boolean> {
    if (!this.mailer.enabled || !this.web.configured) return false;

    const link = this.web.tokenLink(INVITE_PATH, token, 'invitation link');
    try {
      const invitation = await invitationEmail({
        origin: this.mailer.origin,
        inviter: owner.email,
        link,
        days: INVITE_DAYS,
      });
      await this.mailer.sendAccountMail({
        kind: 'invitation',
        to: email,
        ...invitation,
        secrets: [token],
      });
      return true;
    } catch (error) {
      this.logger.error(`invitation email to ${email} failed`, error);
      return false;
    }
  }
}

function toMember(user: User): WorkspaceMember {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: workspaceRoleOf(user.role),
    createdAt: user.createdAt.toISOString(),
  };
}

function toInvite(invite: WorkspaceInvite): WorkspaceInviteItem {
  return {
    id: invite.id,
    email: invite.email,
    role: workspaceRoleOf(invite.role),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

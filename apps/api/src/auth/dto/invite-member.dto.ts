import { IsEmail } from 'class-validator';
import type { InviteMemberRequest } from '@asobeast/shared';

export class InviteMemberDto implements InviteMemberRequest {
  @IsEmail()
  email!: string;
}

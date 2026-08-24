import { ApiProperty } from '@nestjs/swagger';
import { AppLinkRequest } from '@asobeast/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkAppDto implements AppLinkRequest {
  @ApiProperty({ example: 'clx0abcd1234' })
  @IsString()
  @IsNotEmpty()
  appId!: string;
}

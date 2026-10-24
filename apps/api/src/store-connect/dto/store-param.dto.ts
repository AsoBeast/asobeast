import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SUPPORTED_STORES, type Store } from '@asobeast/shared';

export class StoreParamDto {
  @ApiProperty({ enum: SUPPORTED_STORES })
  @IsIn(SUPPORTED_STORES)
  store!: Store;
}

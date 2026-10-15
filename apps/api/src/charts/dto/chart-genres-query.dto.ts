import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Store, STORES } from '@asobeast/shared';

export class ChartGenresQueryDto {
  @ApiProperty({ enum: STORES })
  @IsIn(STORES)
  store!: Store;
}

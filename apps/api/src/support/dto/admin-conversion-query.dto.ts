import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ADMIN_CONVERSION_WINDOWS,
  type AdminConversionWindow,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class AdminConversionQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_CONVERSION_WINDOWS,
    default: ADMIN_CONVERSION_WINDOWS[0],
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(ADMIN_CONVERSION_WINDOWS)
  days?: AdminConversionWindow;
}

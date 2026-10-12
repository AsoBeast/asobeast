import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import {
  type AppStoreLocalization,
  isAppStoreLocalization,
} from '@asobeast/shared';

@Injectable()
export class LocalizationPipe implements PipeTransform<
  unknown,
  AppStoreLocalization
> {
  transform(value: unknown): AppStoreLocalization {
    if (isAppStoreLocalization(value)) return value;
    throw new BadRequestException(
      `Unknown App Store localization: ${String(value)}`,
    );
  }
}

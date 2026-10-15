import { ChartCaptureRequest } from '@asobeast/shared';
import { ChartKeyQueryDto } from './chart-key-query.dto';

export class ChartCaptureDto
  extends ChartKeyQueryDto
  implements ChartCaptureRequest {}

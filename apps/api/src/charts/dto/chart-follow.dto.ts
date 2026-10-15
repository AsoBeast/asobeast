import { ChartFollowRequest } from '@asobeast/shared';
import { ChartKeyQueryDto } from './chart-key-query.dto';

export class ChartFollowDto
  extends ChartKeyQueryDto
  implements ChartFollowRequest {}

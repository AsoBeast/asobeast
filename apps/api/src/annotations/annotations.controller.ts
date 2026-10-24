import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppAnnotationItem, AppAnnotationList } from '@asobeast/shared';
import { AnnotationsService } from './annotations.service';
import { CreateAnnotationDto } from './dto/create-annotation.dto';

@ApiTags('annotations')
@Controller('apps')
export class AnnotationsController {
  constructor(private readonly annotations: AnnotationsService) {}

  @Post(':id/annotations')
  @ApiCreatedResponse({
    type: Object,
    description: 'The created annotation',
  })
  @ApiOperation({
    summary: 'Mark an event on the app charts',
    description:
      "Stores a named event for one app: a label pinned to one UTC day, drawn as a vertical line on the rank history and visibility charts. market scopes the line to one storefront of the app's store and tag groups a campaign; both are optional. Writes nothing to the store.",
  })
  create(
    @Param('id') id: string,
    @Body() dto: CreateAnnotationDto,
  ): Promise<AppAnnotationItem> {
    return this.annotations.create(id, dto);
  }

  @Get(':id/annotations')
  @ApiOkResponse({
    type: Object,
    description: 'The annotations of the app, oldest day first',
  })
  @ApiOperation({
    summary: 'List the event markers of an app',
  })
  list(@Param('id') id: string): Promise<AppAnnotationList> {
    return this.annotations.list(id);
  }

  @Delete(':id/annotations/:annotationId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove an event marker',
  })
  remove(
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
  ): Promise<void> {
    return this.annotations.remove(id, annotationId);
  }
}

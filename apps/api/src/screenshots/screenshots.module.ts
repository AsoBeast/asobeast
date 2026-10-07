import { Module } from '@nestjs/common';
import { ScreenshotPolicy } from './screenshot-policy';
import { ScreenshotRecorder } from './screenshot-recorder';

@Module({
  providers: [ScreenshotPolicy, ScreenshotRecorder],
  exports: [ScreenshotPolicy, ScreenshotRecorder],
})
export class ScreenshotsModule {}

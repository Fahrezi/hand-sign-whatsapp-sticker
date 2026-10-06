import { Module } from '@nestjs/common';
import { AuthEventsService } from './auth-events.service.js';

@Module({
  providers: [AuthEventsService],
  exports: [AuthEventsService],
})
export class AuthEventsModule {}

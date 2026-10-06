import { Module } from '@nestjs/common';
import { AuthEventsModule } from '../auth-events/auth-events.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [AuthModule, AuthEventsModule],
  controllers: [MeController],
})
export class MeModule {}

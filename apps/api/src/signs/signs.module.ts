import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SignsController } from './signs.controller.js';
import { SignsService } from './signs.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SignsController],
  providers: [SignsService],
})
export class SignsModule {}

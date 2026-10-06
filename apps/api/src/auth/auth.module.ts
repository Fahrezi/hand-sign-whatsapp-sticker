import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthEventsModule } from '../auth-events/auth-events.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SESSION_TTL_SECONDS } from './session.js';

@Module({
  imports: [
    UsersModule,
    AuthEventsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: SESSION_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard],
  // UsersModule is re-exported so SessionGuard can be used from other modules
  exports: [AuthService, SessionGuard, UsersModule],
})
export class AuthModule {}

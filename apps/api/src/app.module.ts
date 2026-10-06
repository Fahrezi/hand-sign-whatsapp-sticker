import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config.js';
import { loggerParams } from './logger.js';
import { MeModule } from './me/me.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SignsModule } from './signs/signs.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => loggerParams(config),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    MeModule,
    SignsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

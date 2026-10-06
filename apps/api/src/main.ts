import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { LOCAL_UPLOADS_PREFIX, StorageService, localUploadsDir } from './storage/storage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  if (app.get(StorageService).isLocal) {
    app.useStaticAssets(localUploadsDir(app.get(ConfigService)), {
      prefix: LOCAL_UPLOADS_PREFIX,
      immutable: true,
      maxAge: '1y',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    });
  }
  // Behind a reverse proxy (Render/Fly/...), trust its X-Forwarded-For so req.ip is the client IP.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  // In dev the Vite server proxies /api, so CORS only matters when web and api are on different origins.
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

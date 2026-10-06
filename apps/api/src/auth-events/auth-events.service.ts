import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuthEventType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_USER_AGENT = 512;

@Injectable()
export class AuthEventsService {
  private readonly logger = new Logger(AuthEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Best-effort: a failed audit write is logged but never breaks the request.
  async record(
    type: AuthEventType,
    req: Request,
    userId: string | null,
    meta?: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          type,
          userId,
          ip: req.ip ?? null,
          userAgent: req.get('user-agent')?.slice(0, MAX_USER_AGENT) ?? null,
          meta,
        },
      });
    } catch (err) {
      this.logger.error(`failed to record auth event ${type}`, err instanceof Error ? err.stack : String(err));
    }
  }
}

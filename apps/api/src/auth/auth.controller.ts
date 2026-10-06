import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser, GoogleLoginRequest } from '@hand-sign/shared';
import { AuthEventsService } from '../auth-events/auth-events.service.js';
import { UsersService, toAuthUser } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sessionCookieOptions } from './session.js';
import { SessionGuard, type AuthedRequest } from './session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly events: AuthEventsService,
  ) {}

  @Post('google')
  @HttpCode(200)
  async google(
    @Body() body: Partial<GoogleLoginRequest>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    if (typeof body?.credential !== 'string') throw new BadRequestException('credential is required');

    let profile;
    try {
      profile = await this.auth.verifyGoogleCredential(body.credential);
    } catch (err) {
      const reason = err instanceof HttpException ? err.message : 'error';
      await this.events.record('login_failed', req, null, { reason });
      throw err;
    }

    const user = await this.users.upsertFromGoogle(profile);
    const token = await this.auth.signSession(user.id);
    res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
    await this.events.record('login', req, user.id);
    return toAuthUser(user);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest): AuthUser {
    return toAuthUser(req.user);
  }

  // Not guarded: logging out with an expired session must still clear the cookie.
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') {
      const userId = await this.auth.verifySession(token).catch(() => null);
      if (userId) await this.events.record('logout', req, userId);
    }
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  }
}

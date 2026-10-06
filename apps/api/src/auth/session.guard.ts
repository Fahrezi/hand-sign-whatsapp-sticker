import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './session.js';

export type AuthedRequest = Request & { user: User };

// Requires a valid session cookie for an existing user; exposes it as req.user.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException();
    const user = await this.users.findById(await this.auth.verifySession(token));
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}

import { BadRequestException, Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthUser, SetUsernameRequest } from '@hand-sign/shared';
import { AuthEventsService } from '../auth-events/auth-events.service.js';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js';
import { UsersService, toAuthUser } from '../users/users.service.js';

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly events: AuthEventsService,
  ) {}

  @Put('username')
  async setUsername(@Req() req: AuthedRequest, @Body() body: Partial<SetUsernameRequest>): Promise<AuthUser> {
    if (typeof body?.username !== 'string') throw new BadRequestException('username is required');
    const from = req.user.username;
    const user = await this.users.setUsername(req.user.id, body.username);
    if (user.username !== from) {
      await this.events.record('username_set', req, user.id, { from, to: user.username });
    }
    return toAuthUser(user);
  }
}

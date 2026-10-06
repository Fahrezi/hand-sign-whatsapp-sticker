import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleProfile } from '../users/users.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  private readonly googleClientId: string;
  private readonly google = new OAuth2Client();

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.googleClientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  // Verifies the Google ID token signature, audience and expiry.
  async verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
    let payload;
    try {
      const ticket = await this.google.verifyIdToken({
        idToken: credential,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }

  // Session token only carries the user id; profile data is read from the DB.
  signSession(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies SessionPayload);
  }

  // Returns the user id, or 401 for invalid/expired tokens and old-format sessions.
  async verifySession(token: string): Promise<string> {
    let payload: Partial<SessionPayload>;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) {
      throw new UnauthorizedException();
    }
    return payload.sub;
  }
}

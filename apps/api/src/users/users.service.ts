import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { USERNAME_PATTERN, type AuthUser } from '@hand-sign/shared';
import { Prisma, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    picture: user.avatarUrl,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the user on first login; refreshes profile fields on later logins.
  upsertFromGoogle(profile: GoogleProfile): Promise<User> {
    const data = { email: profile.email, name: profile.name, avatarUrl: profile.picture };
    return this.prisma.user.upsert({
      where: { googleSub: profile.sub },
      create: { googleSub: profile.sub, ...data },
      update: data,
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async setUsername(id: string, raw: string): Promise<User> {
    const username = raw.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      throw new BadRequestException('Username harus 3–20 karakter: huruf kecil, angka, atau _');
    }
    try {
      return await this.prisma.user.update({ where: { id }, data: { username } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Username sudah dipakai');
      }
      throw err;
    }
  }
}

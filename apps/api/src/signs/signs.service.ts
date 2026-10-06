import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CUSTOM_SIGN_FEATURE_VERSION,
  type CustomSignModelsResponse,
  type MySignsResponse,
  type UserSignSummary,
} from '@hand-sign/shared';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { parseCreateSign, parseUpdateSign, sniffImage } from './sign-input.js';

const SUMMARY_SELECT = { id: true, name: true, stickerUrl: true, confetti: true, createdAt: true } as const;

@Injectable()
export class SignsService {
  readonly maxPerUser: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxPerUser = Number(config.get('MAX_SIGNS_PER_USER') ?? 5);
  }

  async listMine(userId: string): Promise<MySignsResponse> {
    const signs = await this.prisma.sign.findMany({
      where: { ownerId: userId, source: 'custom' },
      orderBy: { createdAt: 'desc' },
      select: SUMMARY_SELECT,
    });
    return {
      signs: signs.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      limit: this.maxPerUser,
    };
  }

  // Samples included so the client can match them locally.
  async modelsMine(userId: string): Promise<CustomSignModelsResponse> {
    const signs = await this.prisma.sign.findMany({
      where: { ownerId: userId, source: 'custom' },
      orderBy: { createdAt: 'desc' },
      include: {
        samples: {
          where: { featureVersion: CUSTOM_SIGN_FEATURE_VERSION },
          select: { landmarks: true, handCount: true },
        },
      },
    });
    return {
      signs: signs.map((s) => ({
        id: s.id,
        name: s.name,
        stickerUrl: s.stickerUrl,
        emojiUrl: s.emojiUrl,
        confetti: s.confetti,
        colors: { dark: s.colorDark, light: s.colorLight },
        handCount: s.samples[0]?.handCount ?? 1,
        featureVersion: CUSTOM_SIGN_FEATURE_VERSION,
        samples: s.samples.map((x) => Buffer.from(x.landmarks).toString('base64')),
      })),
    };
  }

  async create(user: User, rawData: unknown, sticker: Buffer | undefined): Promise<UserSignSummary> {
    if (!user.username) throw new ForbiddenException('Pilih username dulu');
    const input = parseCreateSign(rawData);
    if (!sticker) throw new BadRequestException('Sticker wajib diupload');
    const image = sniffImage(sticker);

    const count = await this.prisma.sign.count({ where: { ownerId: user.id, source: 'custom' } });
    if (count >= this.maxPerUser) throw new ConflictException(`Maksimal ${this.maxPerUser} gestur`);

    const key = `stickers/${user.id}/${randomUUID()}.${image.ext}`;
    const url = await this.storage.put(key, sticker, image.type);
    try {
      const sign = await this.prisma.sign.create({
        data: {
          ownerId: user.id,
          source: 'custom',
          name: input.name,
          stickerUrl: url,
          // custom signs use the sticker for the floating emoji grid too
          emojiUrl: url,
          confetti: input.confetti,
          colorDark: input.colors.dark,
          colorLight: input.colors.light,
          samples: {
            createMany: {
              data: input.samples.map((s) => ({
                landmarks: s.landmarks,
                handedness: [s.handedness],
                handCount: 1,
                featureVersion: CUSTOM_SIGN_FEATURE_VERSION,
              })),
            },
          },
        },
        select: SUMMARY_SELECT,
      });
      return { ...sign, createdAt: sign.createdAt.toISOString() };
    } catch (err) {
      await this.storage.delete(key);
      throw err;
    }
  }

  // Name and confetti always; the sticker only when a new one is uploaded (old file removed, best effort).
  async update(userId: string, id: string, rawData: unknown, sticker: Buffer | undefined): Promise<UserSignSummary> {
    const input = parseUpdateSign(rawData);
    const image = sticker ? sniffImage(sticker) : null;
    const current = await this.prisma.sign.findFirst({
      where: { id, ownerId: userId, source: 'custom' },
      select: { stickerUrl: true },
    });
    if (!current) throw new NotFoundException('Gestur tidak ditemukan');

    let newKey: string | null = null;
    let url = current.stickerUrl;
    if (sticker && image) {
      newKey = `stickers/${userId}/${randomUUID()}.${image.ext}`;
      url = await this.storage.put(newKey, sticker, image.type);
    }
    try {
      const sign = await this.prisma.sign.update({
        where: { id },
        data: { name: input.name, confetti: input.confetti, stickerUrl: url, emojiUrl: url },
        select: SUMMARY_SELECT,
      });
      if (newKey) {
        const oldKey = this.storage.keyFromUrl(current.stickerUrl);
        if (oldKey) await this.storage.delete(oldKey);
      }
      return { ...sign, createdAt: sign.createdAt.toISOString() };
    } catch (err) {
      if (newKey) await this.storage.delete(newKey);
      throw err;
    }
  }

  // Samples go with it (cascade); the sticker file is removed afterwards, best effort.
  async remove(userId: string, id: string): Promise<void> {
    const sign = await this.prisma.sign.findFirst({
      where: { id, ownerId: userId, source: 'custom' },
      select: { stickerUrl: true },
    });
    if (!sign) throw new NotFoundException('Gestur tidak ditemukan');
    await this.prisma.sign.delete({ where: { id } });
    const key = this.storage.keyFromUrl(sign.stickerUrl);
    if (key) await this.storage.delete(key);
  }
}

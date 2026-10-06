import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { AuthService } from './../src/auth/auth.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { UsersService } from './../src/users/users.service.js';
import { TEST_ENV } from './test-env.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User", "Sign", "SignSample", "AuthEvent" CASCADE');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // Creates a user the same way Google login does and returns its session cookie.
  async function login(sub = 'google-1', email = 'a@example.com') {
    const user = await app.get(UsersService).upsertFromGoogle({ sub, email, name: 'A', picture: null });
    const token = await app.get(AuthService).signSession(user.id);
    return { user, cookie: `session=${token}` };
  }

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', signPackSchemaVersion: 1 });
  });

  describe('auth', () => {
    it('/api/auth/me without session is 401', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('/api/auth/me with a forged session is 401', () => {
      return request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'session=not-a-jwt').expect(401);
    });

    it('/api/auth/me returns the user, username null for a new account', async () => {
      const { user, cookie } = await login();
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200)
        .expect({ id: user.id, email: 'a@example.com', username: null, name: 'A', picture: null });
    });

    it('/api/auth/me with an old-format or non-uuid session is 401', async () => {
      const jwt = app.get(JwtService);
      for (const payload of [{ id: '123', email: 'a@example.com' }, { sub: '1234567890' }]) {
        const token = await jwt.signAsync(payload);
        await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `session=${token}`).expect(401);
      }
    });

    it('/api/auth/me for a deleted user is 401', async () => {
      const { cookie } = await login();
      await prisma.user.deleteMany();
      return request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });

    it('/api/auth/google without credential is 400', () => {
      return request(app.getHttpServer()).post('/api/auth/google').send({}).expect(400);
    });

    it('/api/auth/logout clears the cookie', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
      expect(res.headers['set-cookie']?.[0]).toMatch(/^session=;/);
    });
  });

  describe('PUT /api/me/username', () => {
    it('sets a normalized username', async () => {
      const { cookie } = await login();
      const res = await request(app.getHttpServer())
        .put('/api/me/username')
        .set('Cookie', cookie)
        .send({ username: '  Luthfi_01 ' })
        .expect(200);
      expect(res.body.username).toBe('luthfi_01');
    });

    it('rejects invalid usernames', async () => {
      const { cookie } = await login();
      for (const username of ['ab', 'has space', 'x'.repeat(21), 'emoji🙂']) {
        await request(app.getHttpServer())
          .put('/api/me/username')
          .set('Cookie', cookie)
          .send({ username })
          .expect(400);
      }
    });

    it('rejects a username taken by someone else, case-insensitively', async () => {
      const a = await login('google-a', 'a@example.com');
      const b = await login('google-b', 'b@example.com');
      await request(app.getHttpServer()).put('/api/me/username').set('Cookie', a.cookie).send({ username: 'taken' }).expect(200);
      await request(app.getHttpServer()).put('/api/me/username').set('Cookie', b.cookie).send({ username: 'TAKEN' }).expect(409);
    });

    it('requires login', () => {
      return request(app.getHttpServer()).put('/api/me/username').send({ username: 'abc' }).expect(401);
    });
  });

  describe('auth events', () => {
    const profile = { sub: 'google-x', email: 'x@example.com', name: 'X', picture: null };
    const events = () => prisma.authEvent.findMany({ orderBy: { createdAt: 'asc' } });

    it('google login creates the user, sets the session cookie and records a login', async () => {
      vi.spyOn(app.get(AuthService), 'verifyGoogleCredential').mockResolvedValue(profile);
      const res = await request(app.getHttpServer())
        .post('/api/auth/google')
        .set('User-Agent', 'e2e-agent')
        .send({ credential: 'fake' })
        .expect(200);

      expect(res.body).toMatchObject({ email: 'x@example.com', username: null });
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toMatch(/^session=.+; .*HttpOnly/);
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie.split(';')[0]).expect(200);

      const [event] = await events();
      expect(event).toMatchObject({ type: 'login', userId: res.body.id, userAgent: 'e2e-agent' });
      expect(event.ip).toBeTruthy();
    });

    it('rejected google login records login_failed without a user', async () => {
      vi.spyOn(app.get(AuthService), 'verifyGoogleCredential').mockRejectedValue(
        new UnauthorizedException('Invalid Google credential'),
      );
      await request(app.getHttpServer()).post('/api/auth/google').send({ credential: 'bad' }).expect(401);

      const all = await events();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ type: 'login_failed', userId: null, meta: { reason: 'Invalid Google credential' } });
      expect(JSON.stringify(all[0])).not.toContain('bad');
    });

    it('logout records the user; anonymous logout records nothing', async () => {
      const { user, cookie } = await login();
      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
      const all = await events();
      expect(all.map((e) => [e.type, e.userId])).toEqual([['logout', user.id]]);
    });

    it('username change records from/to', async () => {
      const { user, cookie } = await login();
      await request(app.getHttpServer()).put('/api/me/username').set('Cookie', cookie).send({ username: 'first' }).expect(200);
      await request(app.getHttpServer()).put('/api/me/username').set('Cookie', cookie).send({ username: 'first' }).expect(200);
      const all = await events();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ type: 'username_set', userId: user.id, meta: { from: null, to: 'first' } });
    });

    it('deleting a user deletes their events', async () => {
      const { user, cookie } = await login();
      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      await prisma.user.delete({ where: { id: user.id } });
      expect(await events()).toHaveLength(0);
    });
  });

  describe('GET /api/signs/mine', () => {
    it('lists only my custom signs, newest first, with the limit', async () => {
      const me = await login('google-a', 'a@example.com');
      const other = await login('google-b', 'b@example.com');
      const base = { source: 'custom' as const, emojiUrl: 'e', confetti: '✨', colorDark: '#000', colorLight: '#fff' };
      await prisma.sign.create({ data: { ...base, ownerId: me.user.id, name: 'old', stickerUrl: 's1', createdAt: new Date(1000) } });
      await prisma.sign.create({ data: { ...base, ownerId: me.user.id, name: 'new', stickerUrl: 's2', createdAt: new Date(2000) } });
      await prisma.sign.create({ data: { ...base, ownerId: other.user.id, name: 'theirs', stickerUrl: 's3' } });

      const res = await request(app.getHttpServer()).get('/api/signs/mine').set('Cookie', me.cookie).expect(200);
      expect(res.body.limit).toBe(5);
      expect(res.body.signs.map((s: { name: string }) => s.name)).toEqual(['new', 'old']);
      expect(Object.keys(res.body.signs[0]).sort()).toEqual(['confetti', 'createdAt', 'id', 'name', 'stickerUrl']);
    });

    it('requires login', () => {
      return request(app.getHttpServer()).get('/api/signs/mine').expect(401);
    });
  });

  describe('POST /api/signs', () => {
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

    function sample(seed = 0.5) {
      const arr = new Float32Array(63).map((_, i) => (i % 3 === 2 ? 0 : seed + (i % 7) * 0.01));
      return { landmarks: Buffer.from(arr.buffer).toString('base64'), handedness: 'Right' };
    }

    function body(overrides: Record<string, unknown> = {}) {
      return {
        name: ' Metal ',
        handCount: 1,
        confetti: '🤘',
        colors: { dark: '#112233', light: '#aabbcc' },
        featureVersion: 1,
        samples: Array.from({ length: 30 }, (_, i) => sample(0.3 + i * 0.01)),
        ...overrides,
      };
    }

    async function withUsername() {
      const session = await login();
      await prisma.user.update({ where: { id: session.user.id }, data: { username: 'maker' } });
      return session;
    }

    function post(cookie: string, data: unknown, sticker: Buffer | null = PNG) {
      const req = request(app.getHttpServer()).post('/api/signs').set('Cookie', cookie).field('data', JSON.stringify(data));
      return sticker ? req.attach('sticker', sticker, 'sticker.png') : req;
    }

    it('creates a sign with its samples and stores the sticker', async () => {
      const { user, cookie } = await withUsername();
      const res = await post(cookie, body()).expect(201);
      expect(res.body).toMatchObject({ name: 'Metal' });
      expect(res.body.stickerUrl).toMatch(new RegExp(`^/api/uploads/stickers/${user.id}/[0-9a-f-]+\\.png$`));
      const key = res.body.stickerUrl.replace('/api/uploads/', '');
      expect(existsSync(join(TEST_ENV.UPLOADS_DIR, key))).toBe(true);

      const models = await request(app.getHttpServer()).get('/api/signs/mine/models').set('Cookie', cookie).expect(200);
      expect(models.body.signs).toHaveLength(1);
      expect(models.body.signs[0]).toMatchObject({ name: 'Metal', confetti: '🤘', handCount: 1, featureVersion: 1 });
      expect(models.body.signs[0].samples).toHaveLength(30);
      expect(models.body.signs[0].samples[0]).toBe(sample(0.3).landmarks);
    });

    it('rejects two-hand signs as coming soon', async () => {
      const { cookie } = await withUsername();
      const res = await post(cookie, body({ handCount: 2 })).expect(400);
      expect(res.body.message).toMatch(/segera hadir/i);
    });

    it('rejects bad input', async () => {
      const { cookie } = await withUsername();
      const bads = [
        body({ name: '   ' }),
        body({ samples: body().samples.slice(0, 29) }),
        body({ samples: [...body().samples.slice(1), { landmarks: 'AAAA', handedness: 'Right' }] }),
        body({ samples: [...body().samples.slice(1), { ...sample(), handedness: 'Middle' }] }),
        body({ samples: [...body().samples.slice(1), sample(99)] }),
        body({ colors: { dark: 'red', light: '#fff' } }),
        body({ featureVersion: 99 }),
      ];
      for (const data of bads) await post(cookie, data).expect(400);
      await post(cookie, body(), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).expect(400);
      expect(await prisma.sign.count()).toBe(0);
    });

    it('requires a sticker and a username', async () => {
      const { cookie } = await login();
      await post(cookie, body()).expect(403);
      const named = await withUsername();
      await post(named.cookie, body(), null).expect(400);
    });

    it('enforces the per-user limit', async () => {
      const { cookie } = await withUsername();
      for (let i = 0; i < 5; i++) await post(cookie, body({ name: `s${i}` })).expect(201);
      await post(cookie, body()).expect(409);
    });

    it('requires login', () => {
      return request(app.getHttpServer()).post('/api/signs').expect(401);
    });
  });

  describe('DELETE /api/signs/:id', () => {
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

    async function createSign(cookie: string) {
      const arr = new Float32Array(63).map((_, i) => (i % 3 === 2 ? 0 : 0.5 + (i % 7) * 0.01));
      const sample = { landmarks: Buffer.from(arr.buffer).toString('base64'), handedness: 'Right' };
      const data = {
        name: 'Metal',
        handCount: 1,
        confetti: '🤘',
        colors: { dark: '#112233', light: '#aabbcc' },
        featureVersion: 1,
        samples: Array.from({ length: 30 }, () => sample),
      };
      const res = await request(app.getHttpServer())
        .post('/api/signs')
        .set('Cookie', cookie)
        .field('data', JSON.stringify(data))
        .attach('sticker', PNG, 'sticker.png')
        .expect(201);
      return res.body as { id: string; stickerUrl: string };
    }

    async function withUsername(sub: string, email: string, username: string) {
      const session = await login(sub, email);
      await prisma.user.update({ where: { id: session.user.id }, data: { username } });
      return session;
    }

    it('deletes my sign, its samples and its sticker file', async () => {
      const { cookie } = await withUsername('google-a', 'a@example.com', 'maker');
      const sign = await createSign(cookie);
      const file = join(TEST_ENV.UPLOADS_DIR, sign.stickerUrl.replace('/api/uploads/', ''));
      expect(existsSync(file)).toBe(true);

      await request(app.getHttpServer()).delete(`/api/signs/${sign.id}`).set('Cookie', cookie).expect(204);
      expect(await prisma.sign.count()).toBe(0);
      expect(await prisma.signSample.count()).toBe(0);
      expect(existsSync(file)).toBe(false);
    });

    it("is 404 for someone else's sign or an unknown id, 400 for a non-uuid", async () => {
      const owner = await withUsername('google-a', 'a@example.com', 'owner');
      const other = await withUsername('google-b', 'b@example.com', 'other');
      const sign = await createSign(owner.cookie);

      await request(app.getHttpServer()).delete(`/api/signs/${sign.id}`).set('Cookie', other.cookie).expect(404);
      await request(app.getHttpServer())
        .delete('/api/signs/00000000-0000-4000-8000-000000000000')
        .set('Cookie', owner.cookie)
        .expect(404);
      await request(app.getHttpServer()).delete('/api/signs/nope').set('Cookie', owner.cookie).expect(400);
      expect(await prisma.sign.count()).toBe(1);
    });

    it('requires login', () => {
      return request(app.getHttpServer()).delete('/api/signs/00000000-0000-4000-8000-000000000000').expect(401);
    });
  });

  describe('PATCH /api/signs/:id', () => {
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(32)]);

    async function withSign(sub = 'google-a', email = 'a@example.com', username = 'maker') {
      const session = await login(sub, email);
      await prisma.user.update({ where: { id: session.user.id }, data: { username } });
      const arr = new Float32Array(63).map((_, i) => (i % 3 === 2 ? 0 : 0.5 + (i % 7) * 0.01));
      const sample = { landmarks: Buffer.from(arr.buffer).toString('base64'), handedness: 'Right' };
      const res = await request(app.getHttpServer())
        .post('/api/signs')
        .set('Cookie', session.cookie)
        .field(
          'data',
          JSON.stringify({
            name: 'Metal',
            handCount: 1,
            confetti: '🤘',
            colors: { dark: '#112233', light: '#aabbcc' },
            featureVersion: 1,
            samples: Array.from({ length: 30 }, () => sample),
          }),
        )
        .attach('sticker', PNG, 'sticker.png')
        .expect(201);
      return { ...session, sign: res.body as { id: string; stickerUrl: string } };
    }

    function patch(cookie: string, id: string, data: unknown, sticker: Buffer | null = null) {
      const req = request(app.getHttpServer()).patch(`/api/signs/${id}`).set('Cookie', cookie).field('data', JSON.stringify(data));
      return sticker ? req.attach('sticker', sticker, 'sticker.gif') : req;
    }

    const fileOf = (url: string) => join(TEST_ENV.UPLOADS_DIR, url.replace('/api/uploads/', ''));

    it('updates name and confetti, keeping the sticker and samples', async () => {
      const { cookie, sign } = await withSign();
      const res = await patch(cookie, sign.id, { name: ' Rock ', confetti: '🎸' }).expect(200);
      expect(res.body).toMatchObject({ id: sign.id, name: 'Rock', confetti: '🎸', stickerUrl: sign.stickerUrl });
      expect(existsSync(fileOf(sign.stickerUrl))).toBe(true);
      expect(await prisma.signSample.count()).toBe(30);
    });

    it('replaces the sticker and removes the old file', async () => {
      const { cookie, sign } = await withSign();
      const res = await patch(cookie, sign.id, { name: 'Metal', confetti: '🤘' }, GIF).expect(200);
      expect(res.body.stickerUrl).toMatch(/\.gif$/);
      expect(existsSync(fileOf(res.body.stickerUrl))).toBe(true);
      expect(existsSync(fileOf(sign.stickerUrl))).toBe(false);
      const row = await prisma.sign.findUniqueOrThrow({ where: { id: sign.id } });
      expect(row.emojiUrl).toBe(res.body.stickerUrl);
    });

    it('rejects bad input without changing anything', async () => {
      const { cookie, sign } = await withSign();
      await patch(cookie, sign.id, { name: '  ', confetti: '🤘' }).expect(400);
      await patch(cookie, sign.id, { name: 'x', confetti: '' }).expect(400);
      await patch(cookie, sign.id, { name: 'x', confetti: '🤘' }, Buffer.from('<svg></svg>')).expect(400);
      const row = await prisma.sign.findUniqueOrThrow({ where: { id: sign.id } });
      expect(row).toMatchObject({ name: 'Metal', confetti: '🤘', stickerUrl: sign.stickerUrl });
    });

    it("is 404 for someone else's sign", async () => {
      const { sign } = await withSign();
      const other = await login('google-b', 'b@example.com');
      await patch(other.cookie, sign.id, { name: 'mine', confetti: '✨' }).expect(404);
    });

    it('requires login', () => {
      return request(app.getHttpServer()).patch('/api/signs/00000000-0000-4000-8000-000000000000').expect(401);
    });
  });
});

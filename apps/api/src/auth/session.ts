import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

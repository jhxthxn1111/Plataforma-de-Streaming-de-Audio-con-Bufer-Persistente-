import type { Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from '../schemas/auth.schemas';
import * as authService from '../services/auth.service';

const REFRESH_COOKIE = 'refresh_token';

// La cookie solo viaja a /auth/*: no se envía en el resto de peticiones.
const cookieBase = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/auth',
} as const;

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

function sendSession(res: Response, status: number, result: authService.AuthResult): void {
  res.cookie(REFRESH_COOKIE, result.refreshToken, { ...cookieBase, expires: result.refreshExpiresAt });
  res.status(status).json({ accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user });
}

export async function register(req: Request, res: Response): Promise<void> {
  sendSession(res, 201, await authService.register(req.body as RegisterInput));
}

export async function login(req: Request, res: Response): Promise<void> {
  sendSession(res, 200, await authService.login(req.body as LoginInput));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    sendSession(res, 200, await authService.refresh(readRefreshCookie(req)));
  } catch (error) {
    if (error instanceof AppError) res.clearCookie(REFRESH_COOKIE, cookieBase);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieBase);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  res.json(await authService.getProfile(req.auth.userId));
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  res.json(await authService.updateProfile(req.auth.userId, req.body as UpdateProfileInput));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  sendSession(res, 200, await authService.changePassword(req.auth.userId, req.body as ChangePasswordInput));
}

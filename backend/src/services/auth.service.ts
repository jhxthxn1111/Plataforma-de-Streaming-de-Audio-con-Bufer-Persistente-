import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { isUniqueViolation } from '../db/errors';
import { AppError } from '../errors/AppError';
import * as refreshModel from '../models/refresh-token.model';
import * as userModel from '../models/user.model';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas';
import type { PublicUser } from '../types/auth';
import { logger } from '../utils/logger';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../utils/password';
import { generateRefreshToken, hashToken, signAccessToken } from '../utils/tokens';

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Dos pestañas pueden refrescar a la vez con el mismo token; dentro de esta ventana no se considera robo. */
const REUSE_GRACE_MS = 10_000;

const invalidCredentials = (): AppError =>
  new AppError(401, 'invalid_credentials', 'Correo o contraseña incorrectos.');
const refreshInvalid = (): AppError => new AppError(401, 'refresh_invalid', 'La sesión expiró.');

function toPublic(user: userModel.UserRecord): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function buildResult(user: userModel.UserRecord, refreshToken: string, refreshExpiresAt: Date): AuthResult {
  return {
    accessToken: signAccessToken(user.id, user.role),
    expiresIn: env.accessTokenTtlSec,
    user: toPublic(user),
    refreshToken,
    refreshExpiresAt,
  };
}

async function startSession(user: userModel.UserRecord): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = refreshExpiry();
  await refreshModel.insert({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId: randomUUID(),
    expiresAt: refreshExpiresAt,
  });
  return buildResult(user, refreshToken, refreshExpiresAt);
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await userModel.create({ email: input.email, displayName: input.displayName, passwordHash });
    return await startSession(user);
  } catch (error) {
    // El índice único (sin distinguir mayúsculas) también cubre dos registros simultáneos.
    if (isUniqueViolation(error)) throw new AppError(409, 'email_taken', 'Ese correo ya tiene una cuenta.');
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userModel.findByEmail(input.email);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();
  return startSession(user);
}

export async function refresh(rawToken: string | undefined): Promise<AuthResult> {
  if (!rawToken) throw refreshInvalid();

  const oldHash = hashToken(rawToken);
  const nextToken = generateRefreshToken();
  const nextExpiresAt = refreshExpiry();

  const rotated = await refreshModel.rotate(oldHash, { tokenHash: hashToken(nextToken), expiresAt: nextExpiresAt });
  if (!rotated) {
    // Un token ya usado que reaparece fuera de la ventana de gracia indica que fue copiado: se cierra toda la cadena.
    const existing = await refreshModel.findByHash(oldHash);
    if (existing?.revokedAt && Date.now() - existing.revokedAt.getTime() > REUSE_GRACE_MS) {
      await refreshModel.revokeFamily(existing.familyId);
      logger.warn('reutilización de refresh token: sesión revocada', { userId: existing.userId });
    }
    throw refreshInvalid();
  }

  const user = await userModel.findById(rotated.userId);
  if (!user) throw refreshInvalid();
  return buildResult(user, nextToken, nextExpiresAt);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const existing = await refreshModel.findByHash(hashToken(rawToken));
  if (existing) await refreshModel.revokeFamily(existing.familyId);
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  return toPublic(user);
}

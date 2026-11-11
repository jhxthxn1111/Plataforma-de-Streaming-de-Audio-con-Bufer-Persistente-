import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { isUniqueViolation } from '../db/errors';
import { AppError } from '../errors/AppError';
import * as emailTokenModel from '../models/email-token.model';
import * as refreshModel from '../models/refresh-token.model';
import * as userModel from '../models/user.model';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../schemas/auth.schemas';
import { passwordChangedEmail, passwordResetEmail, sendMailInBackground, verificationEmail } from './mail.service';
import type { PublicUser } from '../types/auth';
import { logger } from '../utils/logger';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../utils/password';
import { generateOneTimeToken, generateRefreshToken, hashToken, signAccessToken } from '../utils/tokens';

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

const tokenInvalid = (): AppError =>
  new AppError(400, 'token_invalid', 'El enlace no es válido o ya venció. Solicita uno nuevo.');

function appLink(path: string, token?: string): string {
  const base = `${env.frontendUrl.replace(/\/+$/, '')}${path}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/** Evita el "bombardeo" de correos: no se manda otro enlace del mismo tipo hasta pasado el tiempo mínimo. */
async function onCooldown(userId: string, purpose: emailTokenModel.EmailTokenPurpose): Promise<boolean> {
  const last = await emailTokenModel.lastCreatedAt(userId, purpose);
  return last !== null && Date.now() - last.getTime() < env.mailCooldownSec * 1000;
}

async function sendVerificationLink(user: userModel.UserRecord): Promise<void> {
  if (await onCooldown(user.id, 'verify_email')) return;
  const token = generateOneTimeToken();
  await emailTokenModel.issue({
    userId: user.id,
    purpose: 'verify_email',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.emailVerifyTtlHours * 60 * 60 * 1000),
  });
  sendMailInBackground({ to: user.email, ...verificationEmail(user.displayName, appLink('/verificar', token)) });
}

/** Crea la cuenta sin verificar y manda el correo de confirmación. No abre sesión: primero hay que verificar. */
export async function register(input: RegisterInput): Promise<{ email: string }> {
  const passwordHash = await hashPassword(input.password);
  let user: userModel.UserRecord;
  try {
    user = await userModel.create({ email: input.email, displayName: input.displayName, passwordHash });
  } catch (error) {
    // El índice único (sin distinguir mayúsculas) también cubre dos registros simultáneos.
    if (isUniqueViolation(error)) throw new AppError(409, 'email_taken', 'Ese correo ya tiene una cuenta.');
    throw error;
  }
  try {
    await sendVerificationLink(user);
  } catch (error) {
    // La cuenta ya existe: si falla el correo, la persona puede pedir otro enlace desde el login.
    logger.error('no se pudo preparar el correo de verificación', { error: error instanceof Error ? error.message : String(error) });
  }
  return { email: user.email };
}

export async function verifyEmail(token: string): Promise<void> {
  const consumed = await emailTokenModel.consume(hashToken(token), 'verify_email');
  if (!consumed) throw tokenInvalid();
  await userModel.markEmailVerified(consumed.userId);
}

/** Respuesta idéntica exista o no la cuenta (no revela qué correos están registrados). */
export async function resendVerification(email: string): Promise<void> {
  const user = await userModel.findByEmail(email);
  if (user && !user.emailVerifiedAt) await sendVerificationLink(user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await userModel.findByEmail(email);
  if (!user || (await onCooldown(user.id, 'reset_password'))) return;
  const token = generateOneTimeToken();
  await emailTokenModel.issue({
    userId: user.id,
    purpose: 'reset_password',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000),
  });
  sendMailInBackground({ to: user.email, ...passwordResetEmail(user.displayName, appLink('/restablecer', token)) });
}

/**
 * Cierra el cambio de contraseña: quien llega aquí abrió el enlace enviado a su correo, así que prueba
 * que es el dueño. Cierra todas las sesiones y avisa por correo del cambio.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const consumed = await emailTokenModel.consume(hashToken(input.token), 'reset_password');
  if (!consumed) throw tokenInvalid();
  const user = await userModel.findById(consumed.userId);
  if (!user) throw tokenInvalid();
  await userModel.updatePasswordHash(user.id, await hashPassword(input.newPassword));
  await userModel.markEmailVerified(user.id); // recibió un correo en esa dirección: queda comprobada
  await refreshModel.revokeAllForUser(user.id);
  sendMailInBackground({ to: user.email, ...passwordChangedEmail(user.displayName, appLink('/olvide-contrasena')) });
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userModel.findByEmail(input.email);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();
  if (!user.emailVerifiedAt) {
    throw new AppError(403, 'email_not_verified', 'Verifica tu correo para poder iniciar sesión. Revisa tu bandeja de entrada.');
  }
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

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  const user = await userModel.updateDisplayName(userId, input.displayName);
  if (!user) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  return toPublic(user);
}

/** Cambia la contraseña, cierra todas las sesiones y abre una nueva en el dispositivo actual. */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<AuthResult> {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'wrong_password', 'La contraseña actual no es correcta.');
  }
  if (input.currentPassword === input.newPassword) {
    throw new AppError(422, 'validation_error', 'La nueva contraseña debe ser distinta de la actual.');
  }
  await userModel.updatePasswordHash(user.id, await hashPassword(input.newPassword));
  await refreshModel.revokeAllForUser(user.id);
  return startSession(user);
}

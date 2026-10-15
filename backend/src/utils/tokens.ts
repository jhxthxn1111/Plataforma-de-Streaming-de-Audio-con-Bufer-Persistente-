import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { AccessClaims, Role } from '../types/auth';

const ROLES: readonly string[] = ['listener', 'admin'];

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.accessTokenSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: env.accessTokenTtlSec,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const invalid = new AppError(401, 'unauthorized', 'Sesión no válida.');
  let payload: string | jwt.JwtPayload;
  try {
    // Se fija el algoritmo: así no se acepta un token "alg: none" ni firmado con otro método.
    payload = jwt.verify(token, env.accessTokenSecret, { algorithms: ['HS256'] });
  } catch {
    throw invalid;
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string') throw invalid;
  const role: unknown = payload.role;
  if (typeof role !== 'string' || !ROLES.includes(role)) throw invalid;
  return { userId: payload.sub, role: role as Role };
}

/** Token opaco y aleatorio. En la base solo se guarda su hash. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

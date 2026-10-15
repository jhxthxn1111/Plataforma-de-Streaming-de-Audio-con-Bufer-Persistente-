import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { AccessClaims, Role } from '../types/auth';
import { verifyAccessToken } from '../utils/tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

/** Exige un access token válido en `Authorization: Bearer ...` y deja los datos en req.auth. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = /^Bearer (.+)$/.exec(req.header('authorization') ?? '')?.[1];
  if (!token) {
    next(new AppError(401, 'unauthorized', 'Sesión no válida.'));
    return;
  }
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

/** Úsalo después de `authenticate`: restringe la ruta a ciertos roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, 'unauthorized', 'Sesión no válida.'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AppError(403, 'forbidden', 'No tienes permiso para hacer esto.'));
      return;
    }
    next();
  };
}

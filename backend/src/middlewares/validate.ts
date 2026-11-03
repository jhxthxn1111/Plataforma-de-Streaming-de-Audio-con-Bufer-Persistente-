import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../errors/AppError';

/** Valida req.body con Zod. Descarta los campos no declarados (por ejemplo, un "role" enviado por el cliente). */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(422, 'validation_error', parsed.error.issues[0]?.message ?? 'Datos inválidos'));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/**
 * Valida req.query con Zod. En Express 5 `req.query` es de solo lectura,
 * así que el resultado ya validado (con valores por defecto y tipos convertidos) queda en `res.locals.query`.
 */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(new AppError(422, 'validation_error', parsed.error.issues[0]?.message ?? 'Parámetros inválidos'));
      return;
    }
    res.locals.query = parsed.data;
    next();
  };
}

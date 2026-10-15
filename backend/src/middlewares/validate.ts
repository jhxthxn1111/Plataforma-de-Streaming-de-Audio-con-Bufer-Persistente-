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

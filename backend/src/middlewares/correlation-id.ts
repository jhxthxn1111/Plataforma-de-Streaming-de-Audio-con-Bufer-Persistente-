import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

const HEADER = 'x-correlation-id';
const VALID = /^[\w-]{8,64}$/;

/** Reutiliza el id que manda el frontend (si es válido) o crea uno; así se rastrea una petición completa. */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  req.correlationId = incoming && VALID.test(incoming) ? incoming : randomUUID();
  res.setHeader(HEADER, req.correlationId);
  next();
}

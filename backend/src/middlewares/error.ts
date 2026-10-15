import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'not_found', 'Ruta no encontrada'));
}

/** Errores de cliente de Express (por ejemplo, JSON mal formado) traen un status 4xx. */
function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null || !('status' in err)) return null;
  const status = (err as { status: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

// El formato { code, message } es el que el frontend ya sabe interpretar.
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  const clientStatus = clientErrorStatus(err);
  if (clientStatus !== null) {
    res.status(clientStatus).json({ code: 'bad_request', message: 'Solicitud inválida' });
    return;
  }
  logger.error('error no controlado', {
    correlationId: req.correlationId,
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ code: 'internal_error', message: 'Error interno del servidor' });
};

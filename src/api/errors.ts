import axios from 'axios';
import { ZodError } from 'zod';
import { apiErrorSchema } from './contracts';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;

  constructor(status: number, code: string, message: string, correlationId: string | null = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Tu sesión no es válida. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para hacer esto.';
  if (status === 404) return 'No encontramos lo que buscas.';
  if (status === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo otra vez.';
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo en unos segundos.';
  return 'No pudimos completar la solicitud.';
}

/** Convierte cualquier error (Axios, Zod, nativo) en un AppError con mensaje legible. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new AppError(
        0,
        'network_error',
        'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
      );
    }
    const status = error.response.status;
    const rawCorrelation: unknown = error.response.headers['x-correlation-id'];
    const correlationId = typeof rawCorrelation === 'string' ? rawCorrelation : null;
    const parsed = apiErrorSchema.safeParse(error.response.data);
    if (parsed.success) {
      return new AppError(status, parsed.data.code, parsed.data.message, correlationId);
    }
    return new AppError(status, `http_${status}`, defaultMessage(status), correlationId);
  }

  if (error instanceof ZodError) {
    return new AppError(-1, 'invalid_response', 'El servidor devolvió datos con un formato inesperado.');
  }
  if (error instanceof Error) {
    return new AppError(-1, 'unknown', error.message);
  }
  return new AppError(-1, 'unknown', 'Ocurrió un error inesperado.');
}

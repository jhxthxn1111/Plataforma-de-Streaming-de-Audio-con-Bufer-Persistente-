/**
 * Cuándo renovar el ticket firmado del audio.
 *
 * El ticket de /audio/ticket dura 5 minutos. El <audio> lo usa en cada petición Range, así que si pasan más de
 * 5 minutos y la persona salta a otra parte de la canción, el servidor responde 401 y el elemento falla.
 * La solución es pedir un ticket nuevo y retomar donde se quedó, una sola vez por fallo.
 */

/** Códigos de MediaError que produce una petición rechazada: red (2) y fuente no soportada (4). */
const RENEWABLE_MEDIA_ERRORS: ReadonlySet<number> = new Set([2, 4]);

/** Tiempo mínimo entre dos renovaciones: si el servidor sigue rechazando el ticket nuevo, no se entra en bucle. */
export const RENEWAL_COOLDOWN_MS = 10_000;

export interface RenewalContext {
  /** El audio suena desde disco (blob:), no desde una URL firmada: no hay ticket que renovar. */
  isFromCache: boolean;
  isOnline: boolean;
  /** Hay una URL de streaming cargada en el <audio>. */
  hasStreamSource: boolean;
  /** `audio.error?.code` en el momento del fallo (null si no hay). */
  mediaErrorCode: number | null;
  /** Marca de tiempo (ms) de la última renovación; 0 si nunca hubo una. */
  lastRenewalAt: number;
  now: number;
}

export function shouldRenewTicket(context: RenewalContext): boolean {
  if (context.isFromCache || !context.isOnline || !context.hasStreamSource) return false;
  if (context.mediaErrorCode === null || !RENEWABLE_MEDIA_ERRORS.has(context.mediaErrorCode)) return false;
  return context.now - context.lastRenewalAt >= RENEWAL_COOLDOWN_MS;
}

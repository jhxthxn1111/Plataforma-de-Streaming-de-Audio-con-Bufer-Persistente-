import { getCleanBaseUrl } from '@/services/audioUrl';
import { localCatalogSchema, streamTicketSchema, type LocalTrack } from './contracts';
import { http } from './http';

/** Catálogo de canciones del servidor. Requiere sesión: `http` ya envía el token y lo renueva si venció. */
export async function getLocalCatalog(): Promise<LocalTrack[]> {
  const { data } = await http.get<unknown>('/audio/tracks');
  return localCatalogSchema.parse(data).tracks;
}

/**
 * Pide un ticket temporal y devuelve la URL firmada de streaming, lista para usar en <audio> o en una descarga.
 * Si no hay sesión válida lanza un AppError; no existe un camino "sin firma".
 */
export async function requestSignedStreamUrl(fileName: string): Promise<string> {
  const { data } = await http.get<unknown>(`/audio/ticket/${encodeURIComponent(fileName)}`);
  return `${getCleanBaseUrl()}${streamTicketSchema.parse(data).ticketUrl}`;
}

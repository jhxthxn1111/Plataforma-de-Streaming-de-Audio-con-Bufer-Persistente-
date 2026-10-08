import type { RepeatMode } from '@/types/player';

/** Índice de la siguiente canción, o null si la cola terminó. */
export function nextIndex(current: number, length: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (repeat === 'one') return current;
  const candidate = current + 1;
  if (candidate < length) return candidate;
  return repeat === 'all' ? 0 : null;
}

export function previousIndex(current: number, length: number, repeat: RepeatMode): number {
  if (current > 0) return current - 1;
  return repeat === 'all' ? Math.max(length - 1, 0) : 0;
}

/** Nuevo índice actual tras quitar el elemento `removed` de una cola de `length` elementos. */
export function indexAfterRemoval(current: number, removed: number, length: number): number {
  if (length <= 1) return -1;
  if (removed < current) return current - 1;
  if (removed === current) return Math.min(current, length - 2);
  return current;
}

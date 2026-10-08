import type { BufferedRange } from '@/types/player';

export function bufferedSeconds(ranges: BufferedRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(r.end - r.start, 0), 0);
}

/** Segundos ya descargados por delante de la posición actual. */
export function bufferedAhead(ranges: BufferedRange[], position: number): number {
  const containing = ranges.find((r) => position >= r.start - 0.25 && position <= r.end);
  return containing ? Math.max(containing.end - position, 0) : 0;
}

export interface BufferSegment {
  left: number; // % del ancho
  width: number; // % del ancho
}

export function toSegments(ranges: BufferedRange[], duration: number): BufferSegment[] {
  if (duration <= 0) return [];
  return ranges.map((r) => {
    const left = Math.min(Math.max(r.start / duration, 0), 1) * 100;
    const right = Math.min(Math.max(r.end / duration, 0), 1) * 100;
    return { left, width: Math.max(right - left, 0) };
  });
}

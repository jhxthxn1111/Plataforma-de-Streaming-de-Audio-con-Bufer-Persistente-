import { describe, expect, it } from 'vitest';
import { bufferedAhead, bufferedSeconds, toSegments } from '../buffer';

const ranges = [
  { start: 0, end: 30 },
  { start: 50, end: 60 },
];

describe('buffer utils', () => {
  it('suma los segundos descargados', () => expect(bufferedSeconds(ranges)).toBe(40));
  it('calcula el búfer por delante dentro de un rango', () => expect(bufferedAhead(ranges, 10)).toBe(20));
  it('devuelve 0 si la posición está fuera de todo rango', () => expect(bufferedAhead(ranges, 40)).toBe(0));
  it('convierte rangos a porcentajes', () => {
    expect(toSegments(ranges, 100)).toEqual([
      { left: 0, width: 30 },
      { left: 50, width: 10 },
    ]);
  });
  it('no genera segmentos si no hay duración', () => expect(toSegments(ranges, 0)).toEqual([]));
});

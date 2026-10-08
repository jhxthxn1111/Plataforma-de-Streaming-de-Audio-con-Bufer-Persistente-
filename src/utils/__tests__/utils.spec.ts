import { describe, expect, it } from 'vitest';
import { bufferedAhead, toSegments } from '../buffer';
import { formatTime } from '../format';
import { indexAfterRemoval, nextIndex, previousIndex } from '../queue';

describe('queue', () => {
  it('avanza y respeta repeat', () => {
    expect(nextIndex(0, 3, 'off')).toBe(1);
    expect(nextIndex(2, 3, 'off')).toBeNull();
    expect(nextIndex(2, 3, 'all')).toBe(0);
    expect(nextIndex(1, 3, 'one')).toBe(1);
  });
  it('retrocede', () => {
    expect(previousIndex(0, 3, 'off')).toBe(0);
    expect(previousIndex(0, 3, 'all')).toBe(2);
  });
  it('ajusta el índice al quitar', () => {
    expect(indexAfterRemoval(2, 0, 4)).toBe(1);
    expect(indexAfterRemoval(3, 3, 4)).toBe(2);
    expect(indexAfterRemoval(0, 0, 1)).toBe(-1);
  });
});

describe('buffer', () => {
  it('calcula búfer por delante', () => {
    expect(bufferedAhead([{ start: 0, end: 30 }], 10)).toBe(20);
    expect(bufferedAhead([{ start: 0, end: 30 }], 40)).toBe(0);
  });
  it('convierte rangos a segmentos', () => {
    expect(toSegments([{ start: 10, end: 20 }], 100)).toEqual([{ left: 10, width: 10 }]);
  });
});

describe('format', () => {
  it('formatea tiempo', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });
});

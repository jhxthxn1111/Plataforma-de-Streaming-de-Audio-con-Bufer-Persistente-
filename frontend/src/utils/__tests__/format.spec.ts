import { describe, expect, it } from 'vitest';
import { formatBytes, formatListening, formatShortDate, formatTime } from '../format';

describe('format', () => {
  it('formatea tiempo', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });
  it('formatea bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
  it('formatea tiempo de escucha', () => {
    expect(formatListening(45)).toBe('45 s');
    expect(formatListening(600)).toBe('10 min');
    expect(formatListening(5400)).toBe('1 h 30 min');
  });
  it('formatea fecha corta', () => expect(formatShortDate('2026-10-07')).toBe('07/10'));
});

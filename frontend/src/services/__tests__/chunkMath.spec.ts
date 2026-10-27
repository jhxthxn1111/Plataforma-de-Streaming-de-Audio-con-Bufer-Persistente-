import { describe, expect, it } from 'vitest';
import { chunkCount, chunkRange, DEFAULT_CHUNK_BYTES, parseContentRangeTotal } from '../chunkMath';

describe('chunkCount', () => {
  it('redondea hacia arriba', () => {
    expect(chunkCount(1000, 256)).toBe(4);
    expect(chunkCount(1, 256)).toBe(1);
  });
  it('es exacto cuando el archivo es múltiplo del tramo', () => {
    expect(chunkCount(1024, 256)).toBe(4);
  });
  it('devuelve 0 para archivos vacíos o tamaños inválidos', () => {
    expect(chunkCount(0, 256)).toBe(0);
    expect(chunkCount(-5, 256)).toBe(0);
  });
  it('el tramo por defecto es de 256 KB', () => {
    expect(DEFAULT_CHUNK_BYTES).toBe(262144);
  });
});

describe('chunkRange', () => {
  it('el primer tramo empieza en 0', () => {
    expect(chunkRange(0, 1000, 256)).toEqual({ start: 0, end: 255, length: 256 });
  });
  it('un tramo intermedio es contiguo al anterior', () => {
    expect(chunkRange(1, 1000, 256)).toEqual({ start: 256, end: 511, length: 256 });
  });
  it('el último tramo puede ser más corto', () => {
    expect(chunkRange(3, 1000, 256)).toEqual({ start: 768, end: 999, length: 232 });
  });
  it('todos los tramos juntos cubren el archivo sin huecos ni solapes', () => {
    const total = 1000;
    const n = chunkCount(total, 256);
    let next = 0;
    for (let i = 0; i < n; i++) {
      const r = chunkRange(i, total, 256);
      expect(r.start).toBe(next);
      next = r.end + 1;
    }
    expect(next).toBe(total);
  });
  it('lanza RangeError si el tramo no existe', () => {
    expect(() => chunkRange(4, 1000, 256)).toThrow(RangeError);
    expect(() => chunkRange(-1, 1000, 256)).toThrow(RangeError);
    expect(() => chunkRange(1.5, 1000, 256)).toThrow(RangeError);
  });
});

describe('parseContentRangeTotal', () => {
  it('extrae el total de una cabecera válida', () => {
    expect(parseContentRangeTotal('bytes 0-0/5014674')).toBe(5014674);
    expect(parseContentRangeTotal('bytes 100-199/1000')).toBe(1000);
  });
  it('devuelve null si la cabecera falta o es ilegible', () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal('')).toBeNull();
    expect(parseContentRangeTotal('basura')).toBeNull();
  });
  it('devuelve null si el total es desconocido o cero', () => {
    expect(parseContentRangeTotal('bytes 0-0/*')).toBeNull();
    expect(parseContentRangeTotal('bytes 0-0/0')).toBeNull();
  });
});
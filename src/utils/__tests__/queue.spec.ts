import { describe, expect, it } from 'vitest';
import { indexAfterRemoval, nextIndex, previousIndex } from '../queue';

describe('nextIndex', () => {
  it('avanza dentro de la cola', () => expect(nextIndex(0, 3, 'off')).toBe(1));
  it('termina al final sin repetir', () => expect(nextIndex(2, 3, 'off')).toBeNull());
  it('vuelve al inicio con repeat all', () => expect(nextIndex(2, 3, 'all')).toBe(0));
  it('repite la misma canción con repeat one', () => expect(nextIndex(1, 3, 'one')).toBe(1));
  it('devuelve null con cola vacía', () => expect(nextIndex(-1, 0, 'all')).toBeNull());
});

describe('previousIndex', () => {
  it('retrocede', () => expect(previousIndex(2, 3, 'off')).toBe(1));
  it('se queda en 0 sin repetir', () => expect(previousIndex(0, 3, 'off')).toBe(0));
  it('salta al final con repeat all', () => expect(previousIndex(0, 3, 'all')).toBe(2));
});

describe('indexAfterRemoval', () => {
  it('ajusta si se quita una anterior', () => expect(indexAfterRemoval(2, 0, 4)).toBe(1));
  it('mantiene si se quita una posterior', () => expect(indexAfterRemoval(1, 3, 4)).toBe(1));
  it('pasa a la siguiente si se quita la actual', () => expect(indexAfterRemoval(1, 1, 4)).toBe(1));
  it('retrocede si se quita la actual y era la última', () => expect(indexAfterRemoval(3, 3, 4)).toBe(2));
  it('devuelve -1 si la cola queda vacía', () => expect(indexAfterRemoval(0, 0, 1)).toBe(-1));
});

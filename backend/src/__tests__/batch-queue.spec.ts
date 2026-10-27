import { describe, expect, it, vi } from 'vitest';
import { BatchQueue } from '../queue/batch-queue';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('BatchQueue', () => {
  it('procesa lo encolado al hacer flush', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const queue = new BatchQueue<number>({ name: 't', handler, flushIntervalMs: 10_000 });
    queue.enqueue([1, 2, 3]);
    await queue.flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([1, 2, 3]);
    expect(queue.size).toBe(0);
  });

  it('divide en lotes del tamaño máximo', async () => {
    const sizes: number[] = [];
    const queue = new BatchQueue<number>({
      name: 't',
      maxBatchSize: 2,
      flushIntervalMs: 10_000,
      handler: async (batch) => {
        sizes.push(batch.length);
      },
    });
    queue.enqueue([1, 2, 3, 4, 5]);
    await queue.flush();
    expect(sizes).toEqual([2, 2, 1]);
  });

  it('procesa solo por el intervalo, sin llamar a flush', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const queue = new BatchQueue<number>({ name: 't', handler, flushIntervalMs: 10 });
    queue.enqueue([1]);
    await wait(60);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reintenta un lote que falla y termina guardándolo', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('base caída')).mockResolvedValue(undefined);
    const queue = new BatchQueue<number>({ name: 't', handler, retryDelayMs: 1, flushIntervalMs: 10_000 });
    queue.enqueue([1]);
    await queue.flush();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('descarta el lote tras agotar los reintentos y no se queda trabada', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('siempre falla'));
    const queue = new BatchQueue<number>({ name: 't', handler, maxRetries: 2, retryDelayMs: 1, flushIntervalMs: 10_000 });
    queue.enqueue([1]);
    await queue.flush();
    expect(handler).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
    expect(queue.size).toBe(0);
  });

  it('rechaza todo el grupo si la cola está llena', () => {
    const queue = new BatchQueue<number>({ name: 't', handler: async () => {}, maxQueueSize: 3, flushIntervalMs: 10_000 });
    expect(queue.enqueue([1, 2])).toBe(true);
    expect(queue.enqueue([3, 4])).toBe(false);
    expect(queue.size).toBe(2);
  });

  it('no pierde elementos que llegan mientras se está procesando', async () => {
    const processed: number[] = [];
    const queue = new BatchQueue<number>({
      name: 't',
      maxBatchSize: 1,
      flushIntervalMs: 5,
      handler: async (batch) => {
        await wait(20);
        processed.push(...batch);
      },
    });
    queue.enqueue([1]);
    await wait(10);
    queue.enqueue([2]);
    await queue.flush();
    expect(processed.sort()).toEqual([1, 2]);
  });

  it('close vacía la cola y luego rechaza elementos nuevos', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const queue = new BatchQueue<number>({ name: 't', handler, flushIntervalMs: 10_000 });
    queue.enqueue([1, 2]);
    await queue.close();
    expect(handler).toHaveBeenCalledWith([1, 2]);
    expect(queue.enqueue([3])).toBe(false);
  });
});
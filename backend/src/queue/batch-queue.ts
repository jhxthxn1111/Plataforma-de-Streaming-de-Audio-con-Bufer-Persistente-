import { logger } from '../utils/logger';

export interface BatchQueueOptions<T> {
  /** Nombre para los logs. */
  name: string;
  /** Procesa un lote. Si lanza un error, el lote se reintenta. */
  handler: (batch: T[]) => Promise<void>;
  /** Máximo de elementos por lote. */
  maxBatchSize?: number;
  /** Cada cuántos ms se procesa lo acumulado. */
  flushIntervalMs?: number;
  /** Reintentos por lote antes de descartarlo. */
  maxRetries?: number;
  /** Espera base entre reintentos (se duplica en cada intento). */
  retryDelayMs?: number;
  /** Máximo de elementos pendientes: protege la memoria si la base se cae. */
  maxQueueSize?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cola en memoria con worker: acumula elementos, los agrupa en lotes y los procesa en segundo plano
 * con reintentos y backoff exponencial. La petición HTTP no espera a la base de datos.
 */
export class BatchQueue<T> {
  private items: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private closed = false;

  private readonly name: string;
  private readonly handler: (batch: T[]) => Promise<void>;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly maxQueueSize: number;

  constructor(options: BatchQueueOptions<T>) {
    this.name = options.name;
    this.handler = options.handler;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.maxQueueSize = options.maxQueueSize ?? 10_000;
  }

  get size(): number {
    return this.items.length;
  }

  /** Encola todos los elementos o ninguno. Devuelve false si la cola está cerrada o llena. */
  enqueue(newItems: T[]): boolean {
    if (this.closed || this.items.length + newItems.length > this.maxQueueSize) return false;
    this.items.push(...newItems);
    if (this.items.length >= this.maxBatchSize) {
      void this.process();
    } else {
      this.schedule();
    }
    return true;
  }

  /** Procesa todo lo pendiente y espera a que termine. */
  async flush(): Promise<void> {
    this.clearTimer();
    while (this.items.length > 0 || this.running) {
      await this.process();
    }
  }

  /** Deja de aceptar elementos y vacía la cola (para el apagado ordenado del servidor). */
  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
  }

  private schedule(): void {
    if (this.timer || this.items.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.process();
    }, this.flushIntervalMs);
    this.timer.unref(); // el timer no debe impedir que el proceso termine
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private process(): Promise<void> {
    if (this.running) return this.running;
    if (this.items.length === 0) return Promise.resolve();
    this.clearTimer();
    this.running = this.drain().finally(() => {
      this.running = null;
      this.schedule(); // por si llegaron elementos justo al terminar
    });
    return this.running;
  }

  private async drain(): Promise<void> {
    while (this.items.length > 0) {
      const batch = this.items.splice(0, this.maxBatchSize);
      await this.handleWithRetry(batch);
    }
  }

  private async handleWithRetry(batch: T[]): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.handler(batch);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === this.maxRetries) {
          logger.error(`cola ${this.name}: lote descartado tras ${attempt + 1} intentos`, {
            error: message,
            lost: batch.length,
          });
          return;
        }
        logger.warn(`cola ${this.name}: fallo, reintentando`, { attempt: attempt + 1, error: message });
        await sleep(this.retryDelayMs * 2 ** attempt);
      }
    }
  }
}
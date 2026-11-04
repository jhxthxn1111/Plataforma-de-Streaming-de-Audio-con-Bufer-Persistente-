/**
 * Contador de bytes de audio entregados por /audio/stream.
 *
 * Vive en memoria: se reinicia al reiniciar el servidor y, con varias instancias, cada una cuenta lo suyo.
 * Para la demo basta; si hiciera falta un histórico, habría que guardarlo en la base (tabla de uso por día).
 */
let streamedBytes = 0;

export const streamMetrics = {
  addBytes(bytes: number): void {
    if (Number.isFinite(bytes) && bytes > 0) streamedBytes += bytes;
  },
  totalBytes(): number {
    return streamedBytes;
  },
  /** Solo para pruebas. */
  reset(): void {
    streamedBytes = 0;
  },
};

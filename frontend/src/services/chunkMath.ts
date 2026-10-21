/** Tamaño de cada tramo guardado en disco (256 KB). */
export const DEFAULT_CHUNK_BYTES = 256 * 1024;

export interface ByteRange {
  start: number;
  /** Inclusive, igual que en la cabecera HTTP Range. */
  end: number;
  length: number;
}

export const chunkCount = (totalBytes: number, chunkBytes: number): number =>
  totalBytes <= 0 ? 0 : Math.ceil(totalBytes / chunkBytes);

/** Rango de bytes del tramo `index`. El último tramo puede ser más corto. */
export function chunkRange(index: number, totalBytes: number, chunkBytes: number): ByteRange {
  const start = index * chunkBytes;
  if (!Number.isInteger(index) || index < 0 || start >= totalBytes) {
    throw new RangeError(`El tramo ${index} no existe en un archivo de ${totalBytes} bytes`);
  }
  const end = Math.min(start + chunkBytes, totalBytes) - 1;
  return { start, end, length: end - start + 1 };
}

/** Extrae el tamaño total de `Content-Range: bytes 0-0/5014674`. Devuelve null si no se puede leer. */
export function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const match = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(header.trim());
  if (!match || match[1] === undefined) return null;
  const total = Number(match[1]);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
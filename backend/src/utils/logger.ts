type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

/** Logs estructurados (una línea JSON por evento), fáciles de filtrar por correlationId. */
function log(level: Level, message: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Fields): void => log('info', message, fields),
  warn: (message: string, fields?: Fields): void => log('warn', message, fields),
  error: (message: string, fields?: Fields): void => log('error', message, fields),
};

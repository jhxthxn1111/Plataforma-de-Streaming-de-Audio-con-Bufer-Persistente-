import { createApp } from './app';
import { env } from './config/env';
import { closePool } from './db/pool';
import { logger } from './utils/logger';

const server = createApp().listen(env.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.port}`);
});

function shutdown(signal: string): void {
  logger.info(`Recibida la señal ${signal}, cerrando…`);
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

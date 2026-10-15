import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Manejo global de errores
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[backend] error:', err.message);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(env.port, () => {
  console.log(`Servidor escuchando en http://localhost:${env.port}`);
});
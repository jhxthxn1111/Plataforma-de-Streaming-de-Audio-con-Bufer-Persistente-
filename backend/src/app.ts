import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { correlationId } from './middlewares/correlation-id';
import { errorHandler, notFoundHandler } from './middlewares/error';
import { requestLogger } from './middlewares/request-logger';
import { routes } from './routes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.nodeEnv === 'production') app.set('trust proxy', 1); // detrás del proxy de la nube, para el límite por IP
  app.use(helmet());

  app.use(correlationId);
  app.use(requestLogger);
  app.use(cors({ origin: env.frontendUrl, credentials: true, exposedHeaders: ['x-correlation-id'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

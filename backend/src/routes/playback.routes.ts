import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import * as analyticsController from '../controllers/analytics.controller';
import * as playbackController from '../controllers/playback.controller';
import { AppError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate';
import { validateBody, validateQuery } from '../middlewares/validate';
import { summaryQuerySchema } from '../schemas/analytics.schemas';
import { playbackBatchSchema } from '../schemas/playback.schemas';

export const playbackRouter = Router();

const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiadas peticiones. Espera un momento.')),
});

playbackRouter.post('/analytics/events', authenticate, eventsLimiter, validateBody(playbackBatchSchema), playbackController.recordEvents);

const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiadas peticiones. Espera un momento.')),
});

playbackRouter.get('/analytics/summary', authenticate, summaryLimiter, validateQuery(summaryQuerySchema), analyticsController.getSummary);

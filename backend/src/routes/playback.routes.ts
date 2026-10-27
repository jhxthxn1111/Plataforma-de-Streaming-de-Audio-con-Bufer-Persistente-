import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import * as playbackController from '../controllers/playback.controller';
import { AppError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
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
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import * as adminController from '../controllers/admin.controller';
import { AppError } from '../errors/AppError';
import { authenticate, requireRole } from '../middlewares/authenticate';

export const adminRouter = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiadas peticiones. Espera un momento.')),
});

// Todo lo que cuelga de /admin exige sesión (401 si no hay) y rol de administrador (403 si es oyente).
adminRouter.use('/admin', authenticate, requireRole('admin'), adminLimiter);

adminRouter.get('/admin/overview', adminController.getOverview);

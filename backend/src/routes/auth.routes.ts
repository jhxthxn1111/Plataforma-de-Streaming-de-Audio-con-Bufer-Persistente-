import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import * as authController from '../controllers/auth.controller';
import { AppError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../schemas/auth.schemas';

export const authRouter = Router();

// Frena la fuerza bruta contra el login y la creación masiva de cuentas.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiados intentos. Espera unos minutos.')),
});

// Cada correo que se manda es un costo (y una molestia para el destinatario): límite más estricto.
const mailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiados intentos. Espera unos minutos.')),
});

authRouter.use('/auth', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

authRouter.post('/auth/register', credentialsLimiter, validateBody(registerSchema), authController.register);
authRouter.post('/auth/login', credentialsLimiter, validateBody(loginSchema), authController.login);
authRouter.post('/auth/refresh', authController.refresh);
authRouter.post('/auth/logout', authController.logout);
authRouter.get('/auth/me', authenticate, authController.me);
authRouter.patch('/auth/me', authenticate, validateBody(updateProfileSchema), authController.updateProfile);
authRouter.post('/auth/password', credentialsLimiter, authenticate, validateBody(changePasswordSchema), authController.changePassword);

authRouter.post('/auth/verify-email', credentialsLimiter, validateBody(verifyEmailSchema), authController.verifyEmail);
authRouter.post('/auth/resend-verification', mailLimiter, validateBody(emailOnlySchema), authController.resendVerification);
authRouter.post('/auth/forgot-password', mailLimiter, validateBody(emailOnlySchema), authController.forgotPassword);
authRouter.post('/auth/reset-password', credentialsLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

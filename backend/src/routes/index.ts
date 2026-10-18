import { Router } from 'express';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import audioRoutes from './audio.routes';

export const routes = Router();

routes.use(healthRouter);
routes.use(authRouter);
routes.use('/api/audio', audioRoutes);
routes.use('/audio', audioRoutes);
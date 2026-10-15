import { Router } from 'express';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';

export const routes = Router();

routes.use(healthRouter);
routes.use(authRouter);
// Las rutas de catálogo, streaming y analítica se registran aquí en los siguientes PR.

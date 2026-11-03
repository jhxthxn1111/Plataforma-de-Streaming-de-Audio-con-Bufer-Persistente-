import { Router } from 'express';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import audioRoutes from './audio.routes';
import { playbackRouter } from './playback.routes';
import { playlistRouter } from './playlist.routes';

export const routes = Router();

routes.use(healthRouter);
routes.use(authRouter);
routes.use('/api/audio', audioRoutes);
routes.use('/audio', audioRoutes);
routes.use(playbackRouter);
routes.use('/playlists', playlistRouter);
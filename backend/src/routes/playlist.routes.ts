import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import * as playlistController from '../controllers/playlist.controller';
import { AppError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { addTrackSchema, createPlaylistSchema, renamePlaylistSchema } from '../schemas/playlist.schemas';

export const playlistRouter = Router();

const playlistLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiadas peticiones. Espera un momento.')),
});

// Todo lo de playlists exige sesión; la propiedad de cada playlist se valida en el SQL.
playlistRouter.use(authenticate, playlistLimiter);

playlistRouter.get('/', playlistController.list);
playlistRouter.post('/', validateBody(createPlaylistSchema), playlistController.create);
playlistRouter.get('/:id', playlistController.get);
playlistRouter.patch('/:id', validateBody(renamePlaylistSchema), playlistController.rename);
playlistRouter.delete('/:id', playlistController.remove);
playlistRouter.post('/:id/tracks', validateBody(addTrackSchema), playlistController.addTrack);
playlistRouter.delete('/:id/tracks/:trackKey', playlistController.removeTrack);

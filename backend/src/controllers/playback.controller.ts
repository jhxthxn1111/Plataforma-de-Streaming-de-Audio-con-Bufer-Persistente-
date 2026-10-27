import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { PlaybackBatchInput } from '../schemas/playback.schemas';
import * as playbackService from '../services/playback.service';

export function recordEvents(req: Request, res: Response): void {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  const accepted = playbackService.recordEvents(req.auth.userId, req.body as PlaybackBatchInput);
  // 202 Accepted: los eventos quedan en cola y se guardan en segundo plano.
  res.status(202).json({ accepted });
}
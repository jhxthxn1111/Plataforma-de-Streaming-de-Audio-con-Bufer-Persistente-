import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { SummaryQuery } from '../schemas/analytics.schemas';
import * as analyticsService from '../services/analytics.service';

export async function getSummary(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
  // El userId sale del token: cada persona solo ve su propio consumo.
  const summary = await analyticsService.getSummary(req.auth.userId, res.locals.query as SummaryQuery);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(summary);
}

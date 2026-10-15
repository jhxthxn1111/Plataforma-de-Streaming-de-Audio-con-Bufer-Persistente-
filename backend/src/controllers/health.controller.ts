import type { Request, Response } from 'express';
import * as healthService from '../services/health.service';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await healthService.check();
  res.status(health.database === 'up' ? 200 : 503).json(health);
}

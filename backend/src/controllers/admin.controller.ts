import type { Request, Response } from 'express';
import * as adminService from '../services/admin.service';

export async function getOverview(_req: Request, res: Response): Promise<void> {
  const overview = await adminService.getOverview();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(overview);
}

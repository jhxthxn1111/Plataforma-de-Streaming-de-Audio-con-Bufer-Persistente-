import * as healthModel from '../models/health.model';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSec: number;
}

export async function check(): Promise<HealthStatus> {
  const uptimeSec = Math.round(process.uptime());
  try {
    await healthModel.ping();
    return { status: 'ok', database: 'up', uptimeSec };
  } catch (error) {
    logger.error('la base de datos no responde', { error: error instanceof Error ? error.message : String(error) });
    return { status: 'degraded', database: 'down', uptimeSec };
  }
}

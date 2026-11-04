import { adminOverviewSchema, type AdminOverview } from './contracts';
import { http } from './http';

/**
 * Resumen del panel de administración. Solo responde 200 con rol `admin`:
 * un oyente recibe 403 (llega como AppError con status 403).
 */
export async function getAdminOverview(signal?: AbortSignal): Promise<AdminOverview> {
  const { data } = await http.get<unknown>('/admin/overview', { signal });
  return adminOverviewSchema.parse(data);
}

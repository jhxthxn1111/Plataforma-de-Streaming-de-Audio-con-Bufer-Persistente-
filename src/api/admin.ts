import { adminOverviewSchema, type AdminOverview } from './contracts';
import { http } from './http';

export async function getOverview(): Promise<AdminOverview> {
  const { data } = await http.get<unknown>('/admin/overview');
  return adminOverviewSchema.parse(data);
}

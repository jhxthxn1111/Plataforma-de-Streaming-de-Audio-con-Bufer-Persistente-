import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOverviewSchema } from '../contracts';
import { AppError } from '../errors';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../http', () => ({ http: { get: getMock } }));

import { getAdminOverview } from '../admin';

const overview = {
  activeListeners: 3,
  streamedBytes: 4_812_000_000,
  totalTracks: 5,
  topGenres: [{ genre: 'Rock', share: 0.75 }],
};

describe('api/admin', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pide /admin/overview y valida la respuesta con el contrato', async () => {
    getMock.mockResolvedValue({ data: overview });
    await expect(getAdminOverview()).resolves.toEqual(overview);
    expect(getMock).toHaveBeenCalledWith('/admin/overview', { signal: undefined });
  });

  it('acepta una lista de géneros vacía (catálogo de archivos sin género)', () => {
    expect(adminOverviewSchema.safeParse({ ...overview, topGenres: [] }).success).toBe(true);
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    getMock.mockResolvedValue({ data: { ...overview, topGenres: [{ genre: 'Rock', share: 1.5 }] } });
    await expect(getAdminOverview()).rejects.toThrow();
  });

  it('propaga el 403 que recibe un oyente', async () => {
    getMock.mockImplementation(() => Promise.reject(new AppError(403, 'forbidden', 'No tienes permiso para hacer esto.')));
    const error = await getAdminOverview().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 403, code: 'forbidden' });
  });
});

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/api/contracts';

/** El panel de administración solo se abre con rol admin; el oyente cae en "Sin acceso". */

const { restoreSession } = vi.hoisted(() => ({ restoreSession: vi.fn() }));
vi.mock('@/api/auth', () => ({ restoreSession }));

// Las pantallas no importan aquí: solo el guard. Se sustituyen para no cargar el reproductor.
const stub = { render: () => null };
vi.mock('@/layouts/MainLayout.vue', () => ({ default: stub }));
vi.mock('@/layouts/AuthLayout.vue', () => ({ default: stub }));
vi.mock('@/views/AdminVista.vue', () => ({ default: stub }));
vi.mock('@/views/MenuVista.vue', () => ({ default: stub }));
vi.mock('@/views/ForbiddenView.vue', () => ({ default: stub }));
vi.mock('@/views/LoginVista.vue', () => ({ default: stub }));

const user = (role: User['role']): User => ({ id: 'u1', email: 'a@b.co', displayName: 'Ana', role });
const session = (role: User['role']) => ({ accessToken: 't', expiresIn: 900, user: user(role) });

async function freshRouter() {
  vi.resetModules();
  setActivePinia(createPinia());
  const { router } = await import('../index');
  return router;
}

describe('guard de rutas', () => {
  beforeEach(() => {
    restoreSession.mockReset();
  });

  it('la ruta /admin declara que exige el rol admin', async () => {
    const router = await freshRouter();
    expect(router.resolve('/admin').meta.roles).toEqual(['admin']);
  });

  it('un oyente que entra a /admin termina en "Sin acceso"', async () => {
    restoreSession.mockResolvedValue(session('listener'));
    const router = await freshRouter();
    await router.push('/admin');
    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('un administrador entra a /admin', async () => {
    restoreSession.mockResolvedValue(session('admin'));
    const router = await freshRouter();
    await router.push('/admin');
    expect(router.currentRoute.value.name).toBe('admin');
  });

  it('sin sesión, /admin manda al login', async () => {
    restoreSession.mockImplementation(() => Promise.reject(new Error('sin sesión')));
    const router = await freshRouter();
    await router.push('/admin');
    expect(router.currentRoute.value.name).toBe('login');
  });
});

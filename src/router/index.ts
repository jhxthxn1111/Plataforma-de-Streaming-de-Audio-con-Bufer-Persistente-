import { createRouter, createWebHistory } from 'vue-router';
import type { Role } from '@/api/contracts';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    roles?: Role[];
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guestOnly: true, title: 'Iniciar sesión' },
      children: [{ path: '', name: 'login', component: () => import('@/views/LoginView.vue') }],
    },
    {
      // El layout (con el reproductor) es el padre: no se desmonta al navegar entre hijos.
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'library' } },
        { path: 'explorar', name: 'library', component: () => import('@/views/LibraryView.vue'), meta: { title: 'Explorar' } },
        { path: 'reproduciendo', name: 'now-playing', component: () => import('@/views/NowPlayingView.vue'), meta: { title: 'Reproduciendo' } },
        { path: 'consumo', name: 'analytics', component: () => import('@/views/AnalyticsView.vue'), meta: { title: 'Mi consumo' } },
        { path: 'admin', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { roles: ['admin'], title: 'Administración' } },
        { path: 'sin-acceso', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue'), meta: { title: 'Sin acceso' } },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: 'No encontrado' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

// Navigation Guard asíncrono: espera a restaurar la sesión antes de decidir.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.restore();

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'library' };
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  const roles = to.meta.roles;
  if (roles && (!auth.user || !roles.includes(auth.user.role))) return { name: 'forbidden' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Cauce` : 'Cauce';
});

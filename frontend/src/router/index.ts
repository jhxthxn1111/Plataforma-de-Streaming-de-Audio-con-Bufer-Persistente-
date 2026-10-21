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
      children: [{ path: '', name: 'login', component: () => import('@/views/LoginVista.vue') }],
    },
    {
      path: '/registro',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guestOnly: true, title: 'Crear cuenta' },
      children: [{ path: '', name: 'register', component: () => import('@/views/RegisterVista.vue') }],
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'menu', component: () => import('@/views/MenuVista.vue'), meta: { title: 'Inicio' } },
        { path: 'perfil', name: 'profile', component: () => import('@/views/ProfileVista.vue'), meta: { title: 'Mi perfil' } },
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

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'menu' };
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  const roles = to.meta.roles;
  if (roles && (!auth.user || !roles.includes(auth.user.role))) return { name: 'forbidden' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Música` : 'Música';
});

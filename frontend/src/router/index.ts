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
    // Estas tres son públicas a propósito (sin guestOnly): el enlace del correo debe funcionar aunque ya haya una sesión abierta.
    {
      path: '/verificar',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { title: 'Verificar correo' },
      children: [{ path: '', name: 'verify-email', component: () => import('@/views/VerificarVista.vue') }],
    },
    {
      path: '/olvide-contrasena',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { title: 'Recuperar contraseña' },
      children: [{ path: '', name: 'forgot-password', component: () => import('@/views/OlvidoVista.vue') }],
    },
    {
      path: '/restablecer',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { title: 'Nueva contraseña' },
      children: [{ path: '', name: 'reset-password', component: () => import('@/views/RestablecerVista.vue') }],
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'menu', component: () => import('@/views/MenuVista.vue'), meta: { title: 'Inicio' } },
        { path: 'estadisticas', name: 'stats', component: () => import('@/views/EstadisticasVista.vue'), meta: { title: 'Mis estadísticas' } },
        { path: 'playlists', name: 'playlists', component: () => import('@/views/PlaylistsVista.vue'), meta: { title: 'Mis playlists' } },
        // Solo administración: el guard de abajo manda a "Sin acceso" a quien no tenga el rol (el backend responde 403 igual).
        { path: 'admin', name: 'admin', component: () => import('@/views/AdminVista.vue'), meta: { title: 'Administración', roles: ['admin'] } },
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
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as authApi from '@/api/auth';
import type { LoginRequest, User } from '@/api/contracts';
import { toAppError } from '@/api/errors';
import { tokenStore } from '@/api/tokenStore';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const status = ref<AuthStatus>('unknown');
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => status.value === 'authenticated');
  const isAdmin = computed(() => user.value?.role === 'admin');

  let restorePromise: Promise<void> | null = null;

  /** Recupera la sesión con la cookie de refresh. Se ejecuta una sola vez al arrancar. */
  function restore(): Promise<void> {
    restorePromise ??= (async () => {
      try {
        const session = await authApi.restoreSession();
        user.value = session.user;
        status.value = 'authenticated';
      } catch {
        status.value = 'anonymous';
      }
    })();
    return restorePromise;
  }

  async function login(credentials: LoginRequest): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const session = await authApi.login(credentials);
      user.value = session.user;
      status.value = 'authenticated';
      return true;
    } catch (e) {
      error.value = toAppError(e).message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Aunque el servidor falle, la sesión local se cierra.
    }
    clearSession();
  }

  function clearSession(): void {
    tokenStore.clear();
    user.value = null;
    status.value = 'anonymous';
  }

  return { user, status, loading, error, isAuthenticated, isAdmin, restore, login, logout, clearSession };
});

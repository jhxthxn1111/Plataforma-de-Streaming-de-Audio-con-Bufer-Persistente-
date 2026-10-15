import axios, { type AxiosInstance } from 'axios';
import { env } from '@/config/env';
import { mockAdapter } from '@/mock/adapter';
import { newId } from '@/utils/id';
import { authResponseSchema, type AuthResponse } from './contracts';
import { toAppError } from './errors';
import { tokenStore } from './tokenStore';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retriedAuth?: boolean;
    _retryCount?: number;
  }
}

const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: env.apiBaseUrl,
    withCredentials: true, // envía la cookie HttpOnly del refresh token
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
    ...(env.useMock ? { adapter: mockAdapter } : {}),
  });
}

export const http = createClient();
/** Cliente sin interceptores para el refresh: evita bucles de reintento. */
const refreshClient = createClient();

let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export async function refreshSession(): Promise<AuthResponse> {
  const response = await refreshClient.post<unknown>('/auth/refresh');
  const parsed = authResponseSchema.parse(response.data);
  tokenStore.set(parsed.accessToken);
  return parsed;
}

/** Varias peticiones 401 simultáneas comparten un único refresh. */
let refreshInFlight: Promise<string> | null = null;
function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= refreshSession()
    .then((session) => session.accessToken)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('X-Correlation-Id', newId());
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error)) throw error;
    if (!axios.isAxiosError(error) || !error.config) throw toAppError(error);

    const config = error.config;
    const status = error.response?.status;
    const isAuthRoute = config.url?.startsWith('/auth/') ?? false;

    // 1) Access token vencido: refrescar una vez y repetir la petición.
    if (status === 401 && !config._retriedAuth && !isAuthRoute) {
      config._retriedAuth = true;
      let token: string;
      try {
        token = await refreshAccessToken();
      } catch (refreshError) {
        tokenStore.clear();
        sessionExpiredHandler?.();
        throw toAppError(refreshError);
      }
      config.headers.set('Authorization', `Bearer ${token}`);
      return http.request(config);
    }

    // 2) Fallos transitorios en lecturas: reintento con backoff exponencial.
    const isGet = config.method?.toLowerCase() === 'get';
    const transient = !error.response || (status !== undefined && RETRYABLE_STATUS.has(status));
    const attempt = config._retryCount ?? 0;
    if (isGet && transient && attempt < MAX_RETRIES) {
      config._retryCount = attempt + 1;
      await sleep(300 * 2 ** attempt);
      return http.request(config);
    }

    throw toAppError(error);
  },
);

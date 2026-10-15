import { authResponseSchema, type AuthResponse, type LoginRequest, type RegisterRequest } from './contracts';
import { http } from './http';
import { tokenStore } from './tokenStore';

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await http.post<unknown>('/auth/login', payload);
  const parsed = authResponseSchema.parse(data);
  tokenStore.set(parsed.accessToken);
  return parsed;
}

/** Crea una cuenta de oyente y deja la sesión iniciada. */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const { data } = await http.post<unknown>('/auth/register', payload);
  const parsed = authResponseSchema.parse(data);
  tokenStore.set(parsed.accessToken);
  return parsed;
}

export async function logout(): Promise<void> {
  try {
    await http.post('/auth/logout');
  } finally {
    tokenStore.clear();
  }
}

export { refreshSession as restoreSession } from './http';

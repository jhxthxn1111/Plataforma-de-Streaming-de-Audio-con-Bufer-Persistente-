import { authResponseSchema, type AuthResponse, type LoginRequest } from './contracts';
import { http } from './http';
import { tokenStore } from './tokenStore';

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await http.post<unknown>('/auth/login', payload);
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

import {
  authResponseSchema,
  userSchema,
  type AuthResponse,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type UpdateProfileRequest,
  type User,
} from './contracts';
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

export async function updateProfile(payload: UpdateProfileRequest): Promise<User> {
  const { data } = await http.patch<unknown>('/auth/me', payload);
  return userSchema.parse(data);
}

/** El servidor cierra las demás sesiones y abre una nueva aquí, con su propio access token. */
export async function changePassword(payload: ChangePasswordRequest): Promise<AuthResponse> {
  const { data } = await http.post<unknown>('/auth/password', payload);
  const parsed = authResponseSchema.parse(data);
  tokenStore.set(parsed.accessToken);
  return parsed;
}

import {
  authResponseSchema,
  messageResponseSchema,
  registerResponseSchema,
  userSchema,
  type AuthResponse,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
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

/** Crea la cuenta de oyente y el servidor envía un correo de verificación. No abre sesión. */
export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await http.post<unknown>('/auth/register', payload);
  return registerResponseSchema.parse(data);
}

/** Confirma el correo con el token del enlace. */
export async function verifyEmail(token: string): Promise<void> {
  const { data } = await http.post<unknown>('/auth/verify-email', { token });
  messageResponseSchema.parse(data);
}

/** Pide otro correo de verificación. La respuesta es la misma exista o no la cuenta. */
export async function resendVerification(email: string): Promise<void> {
  const { data } = await http.post<unknown>('/auth/resend-verification', { email });
  messageResponseSchema.parse(data);
}

/** Inicia la recuperación de contraseña. La respuesta es la misma exista o no la cuenta. */
export async function forgotPassword(email: string): Promise<void> {
  const { data } = await http.post<unknown>('/auth/forgot-password', { email });
  messageResponseSchema.parse(data);
}

/** Fija la contraseña nueva con el token del correo. No abre sesión. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { data } = await http.post<unknown>('/auth/reset-password', { token, newPassword });
  messageResponseSchema.parse(data);
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

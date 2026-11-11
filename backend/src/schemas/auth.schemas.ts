import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Escribe tu nombre (mínimo 2 letras)').max(60, 'Máximo 60 caracteres'),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(254),
  password: z
    .string()
    .min(8, 'La contraseña tiene al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga')
    .regex(/[A-Za-z]/, 'Incluye al menos una letra')
    .regex(/\d/, 'Incluye al menos un número'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(254),
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({ displayName: registerSchema.shape.displayName });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual').max(128),
  newPassword: registerSchema.shape.password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const emailToken = z.string().trim().min(20, 'Enlace no válido').max(200, 'Enlace no válido');

export const verifyEmailSchema = z.object({ token: emailToken });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Sirve para pedir otro correo de verificación y para iniciar la recuperación de contraseña. */
export const emailOnlySchema = z.object({ email: registerSchema.shape.email });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z.object({ token: emailToken, newPassword: registerSchema.shape.password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

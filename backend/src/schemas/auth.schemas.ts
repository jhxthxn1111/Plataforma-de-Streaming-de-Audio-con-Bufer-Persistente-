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
